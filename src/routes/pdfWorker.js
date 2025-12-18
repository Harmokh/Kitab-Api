/**
 * PDF Worker Thread
 * Handles CPU-intensive PDF operations without blocking main thread
 */

const { parentPort, workerData } = require("worker_threads");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

const execFileAsync = promisify(execFile);

// Worker ID for debugging
const { workerId } = workerData;

console.log(`Worker ${workerId} initialized`);

/**
 * Extract PDF pages using QPDF
 */
async function extractPages(pdfPath, startPage, endPage, versionId) {
    const startTime = Date.now();

    // Generate unique temp file
    const tempFileName = `extract-w${workerId}-${versionId}-${startPage}-${endPage}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pdf`;
    const tempDir = path.join(path.dirname(pdfPath), "..", "..", "temp");

    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    const tempOutput = path.join(tempDir, tempFileName);

    try {
        // Execute QPDF
        const args = [
            pdfPath,
            "--pages",
            ".",
            `${startPage}-${endPage}`,
            "--",
            tempOutput,
        ];

        await execFileAsync("qpdf", args, {
            timeout: 30000, // 30 seconds
            maxBuffer: 100 * 1024 * 1024, // 100MB
        });

        // Read result
        const buffer = await fs.readFile(tempOutput);

        // Cleanup temp file
        await fs.unlink(tempOutput).catch(() => { });

        const duration = Date.now() - startTime;

        return {
            success: true,
            buffer: Array.from(buffer), // Convert to array for transfer
            size: buffer.length,
            duration,
            workerId,
        };
    } catch (err) {
        // Cleanup on error
        await fs.unlink(tempOutput).catch(() => { });

        throw new Error(`Worker ${workerId} extraction failed: ${err.message}`);
    }
}

/**
 * Get PDF page count
 */
async function getPageCount(pdfPath) {
    try {
        const { stdout } = await execFileAsync("qpdf", [
            "--show-npages",
            pdfPath,
        ]);

        return {
            success: true,
            pageCount: parseInt(stdout.trim(), 10),
            workerId,
        };
    } catch (err) {
        throw new Error(`Worker ${workerId} page count failed: ${err.message}`);
    }
}

/**
 * Message handler
 */
parentPort.on("message", async (task) => {
    try {
        let result;

        switch (task.type) {
            case "extractPages":
                result = await extractPages(
                    task.pdfPath,
                    task.startPage,
                    task.endPage,
                    task.versionId
                );
                break;

            case "getPageCount":
                result = await getPageCount(task.pdfPath);
                break;

            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }

        // Send success response
        parentPort.postMessage({
            success: true,
            data: result,
        });
    } catch (err) {
        // Send error response
        parentPort.postMessage({
            success: false,
            error: err.message,
        });
    }
});

// Handle uncaught errors
process.on("uncaughtException", (err) => {
    console.error(`Worker ${workerId} uncaught exception:`, err);
    parentPort.postMessage({
        success: false,
        error: `Worker crashed: ${err.message}`,
    });
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    console.error(`Worker ${workerId} unhandled rejection:`, err);
    parentPort.postMessage({
        success: false,
        error: `Worker promise rejection: ${err.message}`,
    });
});