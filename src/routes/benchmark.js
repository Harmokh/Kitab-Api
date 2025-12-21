/**
 * Comprehensive Benchmark & Load Testing Script
 * 
 * Usage:
 *   node benchmark.js --url http://localhost:3000 --token YOUR_TOKEN --versionId 1
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    baseURL: process.env.API_URL || 'http://localhost:3000',
    token: process.env.API_TOKEN || '',
    versionId: process.env.VERSION_ID || '1',
    outputDir: './benchmark-results',
};

// Parse command line arguments
process.argv.forEach((arg, i) => {
    if (arg === '--url' && process.argv[i + 1]) config.baseURL = process.argv[i + 1];
    if (arg === '--token' && process.argv[i + 1]) config.token = process.argv[i + 1];
    if (arg === '--versionId' && process.argv[i + 1]) config.versionId = process.argv[i + 1];
});

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
}

// HTTP client
const api = axios.create({
    baseURL: config.baseURL,
    headers: {
        'Authorization': `Bearer ${config.token}`,
    },
    responseType: 'arraybuffer',
    timeout: 60000,
});

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
};

// Statistics calculator
class Stats {
    constructor() {
        this.values = [];
    }

    add(value) {
        this.values.push(value);
    }

    get count() {
        return this.values.length;
    }

    get sum() {
        return this.values.reduce((a, b) => a + b, 0);
    }

    get mean() {
        return this.sum / this.count;
    }

    get min() {
        return Math.min(...this.values);
    }

    get max() {
        return Math.max(...this.values);
    }

    get median() {
        const sorted = [...this.values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    get p95() {
        const sorted = [...this.values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * 0.95) - 1;
        return sorted[index];
    }

    get p99() {
        const sorted = [...this.values].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * 0.99) - 1;
        return sorted[index];
    }
}

// Test functions
async function singleRequestTest(startPage, endPage) {
    const start = Date.now();

    try {
        const response = await api.get('/api/book/version/getpages', {
            params: {
                versionId: config.versionId,
                startPage,
                endPage,
            },
        });

        const duration = Date.now() - start;
        const size = response.data.length;
        const cacheStatus = response.headers['x-cache'] || 'UNKNOWN';
        const totalPages = response.headers['x-total-pages'] || 'UNKNOWN';
        const workerId = response.headers['x-worker'] || 'N/A';

        return {
            success: true,
            duration,
            size,
            cacheStatus,
            totalPages,
            workerId,
            startPage,
            endPage,
        };
    } catch (error) {
        return {
            success: false,
            duration: Date.now() - start,
            error: error.message,
            startPage,
            endPage,
        };
    }
}

async function cachePerformanceTest() {
    console.log('\n🧪 Test 1: Cache Performance (MISS vs HIT)');
    console.log('='.repeat(60));

    const testRange = { start: 1, end: 10 };

    // First request (cache MISS)
    console.log('\n📥 First request (expecting cache MISS)...');
    const miss = await singleRequestTest(testRange.start, testRange.end);

    if (miss.success) {
        console.log(`✅ Duration: ${formatDuration(miss.duration)}`);
        console.log(`   Cache: ${miss.cacheStatus}`);
        console.log(`   Size: ${formatBytes(miss.size)}`);
        console.log(`   Worker: ${miss.workerId}`);
    } else {
        console.log(`❌ Failed: ${miss.error}`);
        return;
    }

    // Wait a bit
    await sleep(500);

    // Second request (cache HIT)
    console.log('\n📥 Second request (expecting cache HIT)...');
    const hit = await singleRequestTest(testRange.start, testRange.end);

    if (hit.success) {
        console.log(`✅ Duration: ${formatDuration(hit.duration)}`);
        console.log(`   Cache: ${hit.cacheStatus}`);
        console.log(`   Size: ${formatBytes(hit.size)}`);

        const speedup = (miss.duration / hit.duration).toFixed(2);
        console.log(`\n⚡ Speedup: ${speedup}x faster`);
        console.log(`   MISS: ${formatDuration(miss.duration)}`);
        console.log(`   HIT:  ${formatDuration(hit.duration)}`);
    } else {
        console.log(`❌ Failed: ${hit.error}`);
    }
}

async function concurrentRequestsTest(numRequests = 10) {
    console.log(`\n🧪 Test 2: Concurrent Requests (${numRequests} simultaneous)`);
    console.log('='.repeat(60));

    const promises = [];
    const startTime = Date.now();

    // Generate different page ranges
    for (let i = 0; i < numRequests; i++) {
        const start = i * 5 + 1;
        const end = start + 4;
        promises.push(singleRequestTest(start, end));
    }

    console.log(`\n📤 Sending ${numRequests} concurrent requests...`);
    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n✅ Successful: ${successful.length}/${numRequests}`);
    console.log(`❌ Failed: ${failed.length}/${numRequests}`);
    console.log(`⏱️  Total time: ${formatDuration(totalDuration)}`);
    console.log(`📊 Throughput: ${(numRequests / (totalDuration / 1000)).toFixed(2)} req/s`);

    if (successful.length > 0) {
        const durations = new Stats();
        successful.forEach(r => durations.add(r.duration));

        console.log(`\n📈 Response Times:`);
        console.log(`   Mean:   ${formatDuration(durations.mean)}`);
        console.log(`   Median: ${formatDuration(durations.median)}`);
        console.log(`   Min:    ${formatDuration(durations.min)}`);
        console.log(`   Max:    ${formatDuration(durations.max)}`);
        console.log(`   P95:    ${formatDuration(durations.p95)}`);
        console.log(`   P99:    ${formatDuration(durations.p99)}`);

        // Worker distribution
        const workers = {};
        successful.forEach(r => {
            const worker = r.workerId;
            workers[worker] = (workers[worker] || 0) + 1;
        });

        console.log(`\n👷 Worker Distribution:`);
        Object.entries(workers).forEach(([worker, count]) => {
            console.log(`   ${worker}: ${count} requests`);
        });
    }

    return { successful: successful.length, failed: failed.length, totalDuration };
}

async function loadTest(duration = 30, requestsPerSecond = 5) {
    console.log(`\n🧪 Test 3: Load Test (${duration}s at ${requestsPerSecond} req/s)`);
    console.log('='.repeat(60));

    const stats = {
        total: 0,
        successful: 0,
        failed: 0,
        durations: new Stats(),
        cacheHits: 0,
        cacheMisses: 0,
    };

    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    const interval = 1000 / requestsPerSecond;

    console.log(`\n🚀 Starting load test...`);

    while (Date.now() < endTime) {
        const batchStart = Date.now();

        // Send one request
        const pageStart = (stats.total % 20) * 5 + 1;
        const result = await singleRequestTest(pageStart, pageStart + 4);

        stats.total++;
        if (result.success) {
            stats.successful++;
            stats.durations.add(result.duration);
            if (result.cacheStatus === 'HIT') stats.cacheHits++;
            else stats.cacheMisses++;
        } else {
            stats.failed++;
        }

        // Progress indicator
        if (stats.total % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            process.stdout.write(`\r   Requests: ${stats.total} | Elapsed: ${elapsed}s | Success: ${stats.successful} | Failed: ${stats.failed}`);
        }

        // Wait for next interval
        const elapsed = Date.now() - batchStart;
        if (elapsed < interval) {
            await sleep(interval - elapsed);
        }
    }

    const totalTime = Date.now() - startTime;

    console.log(`\n\n✅ Load test complete!`);
    console.log(`\n📊 Results:`);
    console.log(`   Total Requests:  ${stats.total}`);
    console.log(`   Successful:      ${stats.successful} (${((stats.successful / stats.total) * 100).toFixed(2)}%)`);
    console.log(`   Failed:          ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(2)}%)`);
    console.log(`   Duration:        ${formatDuration(totalTime)}`);
    console.log(`   Throughput:      ${(stats.total / (totalTime / 1000)).toFixed(2)} req/s`);

    console.log(`\n💾 Cache Performance:`);
    console.log(`   Cache Hits:      ${stats.cacheHits} (${((stats.cacheHits / stats.successful) * 100).toFixed(2)}%)`);
    console.log(`   Cache Misses:    ${stats.cacheMisses} (${((stats.cacheMisses / stats.successful) * 100).toFixed(2)}%)`);

    if (stats.successful > 0) {
        console.log(`\n⏱️  Response Times:`);
        console.log(`   Mean:   ${formatDuration(stats.durations.mean)}`);
        console.log(`   Median: ${formatDuration(stats.durations.median)}`);
        console.log(`   Min:    ${formatDuration(stats.durations.min)}`);
        console.log(`   Max:    ${formatDuration(stats.durations.max)}`);
        console.log(`   P95:    ${formatDuration(stats.durations.p95)}`);
        console.log(`   P99:    ${formatDuration(stats.durations.p99)}`);
    }

    return stats;
}

async function systemStatsTest() {
    console.log('\n🧪 Test 4: System Statistics');
    console.log('='.repeat(60));

    try {
        const response = await axios.get(`${config.baseURL}/api/book/system/stats`, {
            headers: { 'Authorization': `Bearer ${config.token}` },
        });

        const stats = response.data.data;

        console.log('\n💾 Cache Statistics:');
        console.log(`   Files:       ${stats.cache.files}`);
        console.log(`   Size:        ${stats.cache.sizeMB} MB (${stats.cache.sizeGB} GB)`);
        console.log(`   Metadata:    ${stats.cache.metadataEntries} entries`);

        if (stats.workers) {
            console.log('\n👷 Worker Pool:');
            console.log(`   Pool Size:   ${stats.workers.poolSize}`);
            console.log(`   Available:   ${stats.workers.availableWorkers}`);
            console.log(`   Busy:        ${stats.workers.busyWorkers}`);
            console.log(`   Queued:      ${stats.workers.queuedTasks}`);
            console.log(`   Completed:   ${stats.workers.totalTasksCompleted} tasks`);
        }

        console.log('\n🖥️  System:');
        console.log(`   CPUs:        ${stats.system.cpus}`);
        console.log(`   Free Memory: ${stats.system.freeMemory}`);
        console.log(`   Total Memory:${stats.system.totalMemory}`);
        console.log(`   Uptime:      ${stats.system.uptime}`);
    } catch (error) {
        console.log(`❌ Failed to fetch stats: ${error.message}`);
    }
}

// Main benchmark runner
async function runBenchmarks() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     PDF API Performance Benchmark & Load Testing          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📍 Target: ${config.baseURL}`);
    console.log(`📄 Version ID: ${config.versionId}`);
    console.log(`📅 Started: ${new Date().toISOString()}`);

    const results = {
        timestamp: new Date().toISOString(),
        config,
        tests: {},
    };

    try {
        // Test 1: Cache performance
        await cachePerformanceTest();
        await sleep(1000);

        // Test 2: Concurrent requests
        const concurrent = await concurrentRequestsTest(10);
        results.tests.concurrent = concurrent;
        await sleep(2000);

        // Test 3: Load test
        const load = await loadTest(30, 5);
        results.tests.load = load;
        await sleep(1000);

        // Test 4: System stats
        await systemStatsTest();

        // Save results
        const filename = `benchmark-${Date.now()}.json`;
        const filepath = path.join(config.outputDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

        console.log(`\n📁 Results saved to: ${filepath}`);
    } catch (error) {
        console.error(`\n❌ Benchmark failed:`, error.message);
        process.exit(1);
    }

    console.log('\n✅ All benchmarks completed!');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run benchmarks
if (require.main === module) {
    runBenchmarks().catch(console.error);
}

module.exports = {
    singleRequestTest,
    cachePerformanceTest,
    concurrentRequestsTest,
    loadTest,
    systemStatsTest,
};