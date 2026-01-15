const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { Worker } = require("worker_threads");
const os = require("os");
const searchEntirePdf = require("../utils/searchEntirePdf");
const execFileAsync = promisify(execFile);
const rootDir = path.resolve(__dirname, "../../");

// ============================================================
// WORKER THREAD POOL FOR PDF PROCESSING
// ============================================================
class WorkerPool {
    constructor(workerPath, poolSize = null) {
        this.workerPath = workerPath;
        this.poolSize = poolSize || Math.max(2, os.cpus().length - 1);
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.nextWorkerId = 0;

        this.initializePool();
    }

    initializePool() {
        for (let i = 0; i < this.poolSize; i++) {
            this.createWorker();
        }
        console.log(`✅ Worker pool initialized with ${this.poolSize} workers`);
    }

    createWorker() {
        const workerId = this.nextWorkerId++;
        const worker = new Worker(this.workerPath, {
            workerData: { workerId }
        });

        const workerObj = {
            id: workerId,
            worker,
            busy: false,
            tasksCompleted: 0,
        };

        worker.on("error", (err) => {
            console.error(`Worker ${workerId} error:`, err);
            this.replaceWorker(workerObj);
        });

        worker.on("exit", (code) => {
            if (code !== 0) {
                console.error(`Worker ${workerId} exited with code ${code}`);
                this.replaceWorker(workerObj);
            }
        });

        this.workers.push(workerObj);
        this.availableWorkers.push(workerObj);

        return workerObj;
    }

    replaceWorker(oldWorker) {
        const index = this.workers.indexOf(oldWorker);
        if (index > -1) {
            this.workers.splice(index, 1);
        }

        const availIndex = this.availableWorkers.indexOf(oldWorker);
        if (availIndex > -1) {
            this.availableWorkers.splice(availIndex, 1);
        }

        this.createWorker();
    }

    async executeTask(task) {
        return new Promise((resolve, reject) => {
            const taskWrapper = { task, resolve, reject };

            if (this.availableWorkers.length > 0) {
                this.runTask(taskWrapper);
            } else {
                this.taskQueue.push(taskWrapper);
            }
        });
    }

    runTask({ task, resolve, reject }) {
        const workerObj = this.availableWorkers.shift();
        workerObj.busy = true;

        const timeout = setTimeout(() => {
            reject(new Error("Worker task timeout after 60 seconds"));
            this.handleTaskComplete(workerObj);
        }, 60000);

        workerObj.worker.once("message", (result) => {
            clearTimeout(timeout);
            workerObj.tasksCompleted++;

            if (result.success) {
                resolve(result.data);
            } else {
                reject(new Error(result.error));
            }

            this.handleTaskComplete(workerObj);
        });

        workerObj.worker.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
            this.handleTaskComplete(workerObj);
        });

        workerObj.worker.postMessage(task);
    }

    handleTaskComplete(workerObj) {
        workerObj.busy = false;
        this.availableWorkers.push(workerObj);

        if (this.taskQueue.length > 0) {
            const nextTask = this.taskQueue.shift();
            this.runTask(nextTask);
        }
    }

    getStats() {
        return {
            poolSize: this.poolSize,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.workers.filter(w => w.busy).length,
            queuedTasks: this.taskQueue.length,
            totalTasksCompleted: this.workers.reduce((sum, w) => sum + w.tasksCompleted, 0),
        };
    }

    async terminate() {
        const promises = this.workers.map(w => w.worker.terminate());
        await Promise.all(promises);
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        console.log("Worker pool terminated");
    }
}

// ============================================================
// DISK CACHE MANAGER WITH QPDF INTEGRATION
// ============================================================
class DiskCacheManager {
    constructor(options = {}) {
        this.cacheDir = options.cacheDir || path.join(rootDir, "cache", "pdf-pages");
        this.metadataCache = new Map();
        this.metadataTTL = options.metadataTTL || 60 * 60 * 1000;
        this.maxCacheSize = options.maxCacheSize || 5 * 1024 * 1024 * 1024;
        this.maxCacheAge = options.maxCacheAge || 7 * 24 * 60 * 60 * 1000;

        this.ensureCacheDir();
        setInterval(() => this.cleanupOldCache(), 60 * 60 * 1000);
    }

    async ensureCacheDir() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (err) {
            console.error("Failed to create cache directory:", err);
        }
    }

    getCacheKey(versionId, start, end) {
        return crypto
            .createHash("md5")
            .update(`${versionId}-${start}-${end}`)
            .digest("hex");
    }

    getCachePath(cacheKey) {
        const subDir = cacheKey.substring(0, 2);
        return path.join(this.cacheDir, subDir, `${cacheKey}.pdf`);
    }

    async getCached(versionId, start, end) {
        const cacheKey = this.getCacheKey(versionId, start, end);
        const cachePath = this.getCachePath(cacheKey);

        try {
            const stats = await fs.stat(cachePath);

            if (Date.now() - stats.mtime.getTime() > this.maxCacheAge) {
                await fs.unlink(cachePath);
                return null;
            }

            return cachePath;
        } catch (err) {
            return null;
        }
    }

    async setCached(versionId, start, end, pdfBuffer) {
        const cacheKey = this.getCacheKey(versionId, start, end);
        const cachePath = this.getCachePath(cacheKey);
        const cacheSubDir = path.dirname(cachePath);

        try {
            await fs.mkdir(cacheSubDir, { recursive: true });
            await fs.writeFile(cachePath, pdfBuffer);
            return cachePath;
        } catch (err) {
            console.error("Failed to write cache:", err);
            return null;
        }
    }

    async cleanupOldCache() {
        try {
            const now = Date.now();
            let totalSize = 0;
            const files = [];

            const scanDir = async (dir) => {
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });

                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);

                        if (entry.isDirectory()) {
                            await scanDir(fullPath);
                        } else if (entry.isFile() && entry.name.endsWith(".pdf")) {
                            const stats = await fs.stat(fullPath);
                            files.push({
                                path: fullPath,
                                size: stats.size,
                                mtime: stats.mtime.getTime(),
                            });
                            totalSize += stats.size;
                        }
                    }
                } catch (err) {
                    // Ignore errors
                }
            };

            await scanDir(this.cacheDir);

            for (const file of files) {
                if (now - file.mtime > this.maxCacheAge) {
                    await fs.unlink(file.path);
                    totalSize -= file.size;
                }
            }

            if (totalSize > this.maxCacheSize) {
                files.sort((a, b) => a.mtime - b.mtime);

                for (const file of files) {
                    if (totalSize <= this.maxCacheSize) break;

                    try {
                        await fs.unlink(file.path);
                        totalSize -= file.size;
                    } catch (err) {
                        console.error("Failed to delete cache file:", err);
                    }
                }
            }

            console.log(`Cache cleanup complete. Size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        } catch (err) {
            console.error("Cache cleanup error:", err);
        }
    }

    getMetadata(key) {
        const cached = this.metadataCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.metadataTTL) {
            return cached.data;
        }
        return null;
    }

    setMetadata(key, data) {
        this.metadataCache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }

    async getStats() {
        try {
            let totalSize = 0;
            let fileCount = 0;

            const scanDir = async (dir) => {
                try {
                    const entries = await fs.readdir(dir, { withFileTypes: true });

                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);

                        if (entry.isDirectory()) {
                            await scanDir(fullPath);
                        } else if (entry.isFile() && entry.name.endsWith(".pdf")) {
                            const stats = await fs.stat(fullPath);
                            totalSize += stats.size;
                            fileCount++;
                        }
                    }
                } catch (err) {
                    // Directory might not exist
                }
            };

            await scanDir(this.cacheDir);

            return {
                files: fileCount,
                sizeBytes: totalSize,
                sizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                sizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
                metadataEntries: this.metadataCache.size,
            };
        } catch (err) {
            return {
                files: 0,
                sizeBytes: 0,
                sizeMB: "0.00",
                sizeGB: "0.00",
                metadataEntries: this.metadataCache.size,
            };
        }
    }
}

// ============================================================
// QPDF INTEGRATION
// ============================================================
class QPDFProcessor {
    static async extractPages(inputPath, outputPath, startPage, endPage) {
        const args = [
            inputPath,
            "--pages",
            ".",
            `${startPage}-${endPage}`,
            "--",
            outputPath,
        ];

        try {
            await execFileAsync("qpdf", args, {
                timeout: 30000,
                maxBuffer: 100 * 1024 * 1024,
            });
            return true;
        } catch (err) {
            throw new Error(`QPDF extraction failed: ${err.message}`);
        }
    }

    static async getPageCount(pdfPath) {
        try {
            const { stdout } = await execFileAsync("qpdf", [
                "--show-npages",
                pdfPath,
            ]);
            return parseInt(stdout.trim(), 10);
        } catch (err) {
            throw new Error(`Failed to get page count: ${err.message}`);
        }
    }

    static async isInstalled() {
        try {
            await execFileAsync("qpdf", ["--version"]);
            return true;
        } catch (err) {
            return false;
        }
    }
}

// Initialize managers
const cacheManager = new DiskCacheManager({
    cacheDir: path.join(rootDir, "cache", "pdf-pages"),
    maxCacheSize: 5 * 1024 * 1024 * 1024,
    maxCacheAge: 7 * 24 * 60 * 60 * 1000,
    metadataTTL: 60 * 60 * 1000,
});

// Initialize worker pool
const workerPath = path.join(__dirname, "pdfWorker.js");
let workerPool = null;

// Graceful shutdown
process.on("SIGTERM", async () => {
    if (workerPool) await workerPool.terminate();
});
process.on("SIGINT", async () => {
    if (workerPool) await workerPool.terminate();
});


module.exports = (models, router) => {
    const bookRouter = router.Router();
    // Initialize worker pool on first request (lazy loading)
    const ensureWorkerPool = () => {
        if (!workerPool) {
            workerPool = new WorkerPool(workerPath);
        }
        return workerPool;
    };

    // Check QPDF availability
    (async () => {
        const installed = await QPDFProcessor.isInstalled();
        if (!installed) {
            console.warn("⚠️  QPDF not found! Install for optimal performance:");
            console.warn("   Ubuntu/Debian: sudo apt-get install qpdf");
            console.warn("   macOS: brew install qpdf");
        } else {
            console.log("✅ QPDF detected - Using optimized PDF processing");
        }
    })();

    /**
     * Ultra-fast PDF extraction with Worker Threads + QPDF + Disk Cache
     */
    bookRouter.get("/newbook/version/getpages", async (req, res) => {
        const startTime = Date.now();

        try {
            const { versionId, startPage = "1", endPage } = req.query;

            if (!versionId) {
                return res.status(400).json({
                    success: false,
                    message: "versionId is required",
                });
            }

            const start = parseInt(startPage, 10);
            const end = endPage ? parseInt(endPage, 10) : start;

            if (isNaN(start) || isNaN(end)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid page numbers",
                });
            }

            // ETag for client caching
            const etag = `"${versionId}-${start}-${end}"`;
            if (req.headers["if-none-match"] === etag) {
                return res.status(304).end();
            }

            // Get version (with metadata cache)
            const cacheKey = `version:${versionId}`;
            let version = cacheManager.getMetadata(cacheKey);

            if (!version) {
                version = await models.BookVersion.findByPk(versionId, {
                    attributes: ["id", "pdfPath"],
                });

                if (!version) {
                    return res.status(404).json({
                        success: false,
                        message: "Book version not found",
                    });
                }

                cacheManager.setMetadata(cacheKey, version);
            }

            const pdfPath = path.join(rootDir, "public", version.pdfPath);

            if (!fsSync.existsSync(pdfPath)) {
                return res.status(404).json({
                    success: false,
                    message: "PDF file not found",
                });
            }

            // Get total pages (cached)
            const pageCountKey = `pagecount:${versionId}`;
            let totalPages = cacheManager.getMetadata(pageCountKey);

            if (!totalPages) {
                totalPages = await QPDFProcessor.getPageCount(pdfPath);
                cacheManager.setMetadata(pageCountKey, totalPages);
            }

            // Validate page range
            if (start < 1 || end > totalPages || start > end) {
                return res.status(400).json({
                    success: false,
                    message: `Page range must be between 1 and ${totalPages}`,
                });
            }

            // Optimization: Return original file if all pages requested
            if (start === 1 && end === totalPages) {
                const stats = await fs.stat(pdfPath);

                res.setHeader("X-Total-Pages", totalPages);
                res.setHeader("X-Cache", "FULL-FILE");
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Length", stats.size);
                res.setHeader(
                    "Content-Disposition",
                    `inline; filename=pages-${start}-${end}.pdf`
                );
                res.setHeader("Cache-Control", "public, max-age=86400");
                res.setHeader("ETag", etag);

                return res.sendFile(pdfPath);
            }

            // Check disk cache
            let cachedPath = await cacheManager.getCached(versionId, start, end);

            if (cachedPath) {
                const stats = await fs.stat(cachedPath);

                res.setHeader("X-Cache", "HIT");
                res.setHeader("X-Total-Pages", totalPages);
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Length", stats.size);
                res.setHeader(
                    "Content-Disposition",
                    `inline; filename=pages-${start}-${end}.pdf`
                );
                res.setHeader("Cache-Control", "public, max-age=86400");
                res.setHeader("ETag", etag);

                if (process.env.NODE_ENV !== "production") {
                    console.log(
                        `✅ Cache HIT: Pages ${start}-${end} served in ${Date.now() - startTime}ms`
                    );
                }

                return res.sendFile(cachedPath);
            }

            // Cache MISS - Use worker thread for extraction
            const pool = ensureWorkerPool();

            const result = await pool.executeTask({
                type: "extractPages",
                pdfPath,
                startPage: start,
                endPage: end,
                versionId,
            });

            // Read extracted buffer
            const extractedBuffer = Buffer.from(result.buffer);

            // Save to disk cache
            await cacheManager.setCached(versionId, start, end, extractedBuffer);

            // Send response
            res.setHeader("X-Cache", "MISS");
            res.setHeader("X-Worker", `worker-${result.workerId}`);
            res.setHeader("X-Total-Pages", totalPages);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Length", extractedBuffer.length);
            res.setHeader(
                "Content-Disposition",
                `inline; filename=pages-${start}-${end}.pdf`
            );
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.setHeader("ETag", etag);

            if (process.env.NODE_ENV !== "production") {
                console.log(
                    `📦 Cache MISS: Pages ${start}-${end} extracted by worker in ${Date.now() - startTime}ms`
                );
            }

            res.send(extractedBuffer);
        } catch (err) {
            console.error("PDF extraction error:", {
                message: err.message,
                stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
                versionId: req.query.versionId,
                timestamp: new Date().toISOString(),
            });

            res.status(500).json({
                success: false,
                message:
                    process.env.NODE_ENV === "production"
                        ? "Error processing PDF"
                        : err.message,
            });
        }
    });


    bookRouter.get("/newbook/search-words", async (req, res) => {
        let pdfPath = null;

        try {
            const { versionId, query } = req.query;

            if (!versionId || !query) {
                return error(res, "Missing required parameters");
            }

            const version = await models.BookVersion.findByPk(versionId);
            if (!version) {
                return error(res, "Version not found");
            }

            pdfPath = path.join("uploads", version.pdfPath);

            // Validate PDF existence BEFORE search
            if (!fsSync.existsSync(pdfPath)) {
                return error(res, "PDF file not found", {
                    pdfPath
                });
            }

            const results = await searchEntirePdf({ pdfPath, query });

            return success(
                res,
                results,
                MessageType.SUCCESS,
                "Search results",
                { pdfPath, version }
            );

        } catch (err) {
            return error(
                res,
                err.message || "PDF search failed",
                {
                    pdfPath
                }
            );
        }
    });


    // System stats endpoint
    bookRouter.get("/newbook/system/stats", async (req, res) => {
        try {
            const cacheStats = await cacheManager.getStats();
            const pool = ensureWorkerPool();
            const workerStats = pool.getStats();

            return success(
                res,
                {
                    cache: cacheStats,
                    workers: workerStats,
                    system: {
                        cpus: os.cpus().length,
                        freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
                        totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
                        uptime: `${(process.uptime() / 3600).toFixed(2)}h`,
                    },
                },
                "System statistics fetched successfully"
            );
        } catch (err) {
            return error(res, err.message);
        }
    });

    // Cache statistics
    bookRouter.get("/newbook/cache/stats", async (req, res) => {
        try {
            const stats = await cacheManager.getStats();
            return success(res, stats, "Cache statistics fetched successfully");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // Clear cache
    bookRouter.delete("/newbook/cache/clear", authenticate, async (req, res) => {
        try {
            const stats = await cacheManager.getStats();

            await fs.rm(cacheManager.cacheDir, { recursive: true, force: true });
            await cacheManager.ensureCacheDir();

            return success(
                res,
                { clearedFiles: stats.files, clearedSizeMB: stats.sizeMB },
                "Cache cleared successfully"
            );
        } catch (err) {
            return error(res, err.message);
        }
    });

    return bookRouter;
};