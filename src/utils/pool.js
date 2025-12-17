const Piscina = require("piscina");
const os = require("os");

const pool = new Piscina({
    filename: require.resolve("./pdf.worker.js"),
    maxThreads: Math.max(1, os.cpus().length - 1),
    idleTimeout: 60000,
});

module.exports = pool;
