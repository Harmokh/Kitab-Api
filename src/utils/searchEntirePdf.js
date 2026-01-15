const { spawn } = require("child_process");

function searchEntirePdf({ pdfPath, query }) {
    return new Promise((resolve, reject) => {
        const child = spawn("pdftotext", [
            "-layout",
            "-enc", "UTF-8",
            pdfPath,
            "-"
        ]);

        let pageNumber = 1;
        let buffer = "";
        const results = [];
        const regex = new RegExp(query, "gi");

        child.stdout.on("data", chunk => {
            buffer += chunk.toString("utf8");

            const pages = buffer.split("\f");
            buffer = pages.pop(); // keep unfinished page

            for (const pageText of pages) {
                const matches = pageText.match(regex);

                if (matches) {
                    results.push({
                        page: pageNumber,
                        matches: matches.length,
                        snippets: pageText
                            .split("\n")
                            .filter(line => regex.test(line))
                            .slice(0, 3)
                    });
                }
                pageNumber++;
            }
        });

        child.on("close", () => {
            resolve(results); // ENTIRE PDF DONE
        });

        child.on("error", err => reject(err));
    });
}

module.exports = searchEntirePdf;
