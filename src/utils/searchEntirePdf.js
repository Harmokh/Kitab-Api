const { spawn } = require("child_process");

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSnippets(pageText, query, maxSnippets = 3) {
    const lines = pageText.split("\n").filter(line => line.trim());
    const snippets = [];
    const regex = new RegExp(escapeRegExp(query), "gi");

    for (let i = 0; i < lines.length && snippets.length < maxSnippets; i++) {
        if (regex.test(lines[i])) {
            // Include context: previous line, current line, next line
            const contextLines = [
                lines[i - 1]?.trim(),
                lines[i].trim(),
                lines[i + 1]?.trim()
            ].filter(Boolean);

            snippets.push(contextLines.join(" ... "));
        }
    }

    return snippets;
}

function searchEntirePdf({ pdfPath, query }) {
    return new Promise((resolve, reject) => {
        const safeQuery = escapeRegExp(query);
        const regex = new RegExp(safeQuery, "gi");

        // Spawn pdftotext process
        const child = spawn(
            process.env.PDFTOTEXT_BIN || "pdftotext",
            ["-layout", "-enc", "UTF-8", pdfPath, "-"]
        );

        let pageNumber = 1;
        let buffer = "";
        let stderr = "";
        const results = [];

        // Handle stdout data (PDF text content)
        child.stdout.on("data", chunk => {
            buffer += chunk.toString("utf8");

            // Split by form feed character (\f) which separates pages
            const pages = buffer.split("\f");

            // Keep the last incomplete page in buffer
            buffer = pages.pop();

            // Process each complete page
            for (const pageText of pages) {
                const matches = pageText.match(regex);

                if (matches) {
                    results.push({
                        page: pageNumber,
                        matches: matches.length,
                        snippets: extractSnippets(pageText, safeQuery, 3),
                    });
                }
                pageNumber++;
            }
        });

        // Handle stderr (errors)
        child.stderr.on("data", data => {
            stderr += data.toString();
        });

        // Handle process completion
        child.on("close", code => {
            if (code !== 0) {
                return reject(new Error(stderr || `pdftotext exited with code ${code}`));
            }

            // Process the final page remaining in buffer
            if (buffer.trim()) {
                const matches = buffer.match(regex);
                if (matches) {
                    results.push({
                        page: pageNumber,
                        matches: matches.length,
                        snippets: extractSnippets(buffer, safeQuery, 3),
                    });
                }
            }

            resolve(results);
        });

        // Handle spawn errors
        child.on("error", err => {
            reject(new Error(`Failed to spawn pdftotext: ${err.message}. Make sure poppler-utils is installed.`));
        });
    });
}

module.exports = searchEntirePdf;