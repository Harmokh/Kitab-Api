const { spawn } = require("child_process");

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchEntirePdf({ pdfPath, query }) {
    return new Promise((resolve, reject) => {
        const safeQuery = escapeRegExp(query);
        const regex = new RegExp(safeQuery, "gi");

        const child = spawn(
            process.env.PDFTOTEXT_BIN || "/usr/bin/pdftotext",
            ["-layout", "-enc", "UTF-8", pdfPath, "-"]
        );

        let pageNumber = 1;
        let buffer = "";
        let stderr = "";
        const results = [];

        child.stdout.on("data", chunk => {
            buffer += chunk.toString("utf8");

            const pages = buffer.split("\f");
            buffer = pages.pop();

            for (const pageText of pages) {
                const matches = pageText.match(regex);

                if (matches) {
                    results.push({
                        page: pageNumber,
                        matches: matches.length,
                        snippets: pageText
                            .split("\n")
                            .filter(line => new RegExp(safeQuery, "i").test(line))
                            .slice(0, 3),
                    });
                }
                pageNumber++;
            }
        });

        child.stderr.on("data", data => {
            stderr += data.toString();
        });

        child.on("close", code => {
            if (code !== 0) {
                return reject(new Error(stderr || "pdftotext failed"));
            }
            resolve(results);
        });

        child.on("error", reject);
    });
}

module.exports = searchEntirePdf;
