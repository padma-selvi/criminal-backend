const { spawn } = require("child_process");
const path = require("path");

/*
=====================================================
FACE SEARCH DEMO
Node.js -> Python -> Face Recognition
=====================================================
*/

function runFaceSearch(queryPath, candidates) {
  return new Promise((resolve, reject) => {
    console.log("\n=================================");
    console.log("🐍 STARTING PYTHON FACE SEARCH");
    console.log("=================================");

    const pythonFile = path.join(
      __dirname,
      "face_search.py"
    );

    console.log("🐍 Python file:", pythonFile);
    console.log("📷 Query:", queryPath);
    console.log("👥 Candidates:", candidates.length);

    /*
    -------------------------------------------------
    IMPORTANT
    -------------------------------------------------
    Use python command because your system has
    Python 3.14.5.
    */

    const python = spawn(
      "python",
      [pythonFile],
      {
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";

    /*
    -------------------------------------------------
    SEND DATA TO PYTHON
    -------------------------------------------------
    */

    const inputData = JSON.stringify({
      queryPath: queryPath,
      candidates: candidates,
    });

    python.stdin.write(inputData);
    python.stdin.end();

    /*
    -------------------------------------------------
    PYTHON OUTPUT
    -------------------------------------------------
    */

    python.stdout.on(
      "data",
      (data) => {
        const text = data.toString();

        console.log(
          "🐍 Python:",
          text.trim()
        );

        stdout += text;
      }
    );

    /*
    -------------------------------------------------
    PYTHON ERROR OUTPUT
    -------------------------------------------------
    */

    python.stderr.on(
      "data",
      (data) => {
        const text = data.toString();

        console.error(
          "🐍 Python STDERR:",
          text.trim()
        );

        stderr += text;
      }
    );

    /*
    -------------------------------------------------
    PROCESS ERROR
    -------------------------------------------------
    */

    python.on(
      "error",
      (error) => {
        console.error(
          "❌ Python process error:",
          error
        );

        reject(
          new Error(
            "Unable to start Python face recognition: " +
              error.message
          )
        );
      }
    );

    /*
    -------------------------------------------------
    PROCESS FINISHED
    -------------------------------------------------
    */

    python.on(
      "close",
      (code) => {
        console.log(
          "🐍 Python exited with code:",
          code
        );

        console.log(
          "================================="
        );

        /*
        ---------------------------------------------
        PYTHON FAILED
        ---------------------------------------------
        */

        if (code !== 0) {
          console.error(
            "❌ PYTHON FULL ERROR"
          );

          if (stderr) {
            console.error(stderr);
          }

          /*
          Try to return JSON error from Python
          if one was printed before exit.
          */

          try {
            const lines =
              stdout
                .trim()
                .split("\n")
                .filter(Boolean);

            const lastLine =
              lines[lines.length - 1];

            if (lastLine) {
              const result =
                JSON.parse(lastLine);

              return reject(
                new Error(
                  result.message ||
                    "Python face recognition failed"
                )
              );
            }
          } catch (parseError) {
            // Ignore JSON parse error
          }

          return reject(
            new Error(
              stderr ||
                "Python face recognition failed"
            )
          );
        }

        /*
        ---------------------------------------------
        PYTHON SUCCESS
        ---------------------------------------------
        */

        try {
          const lines =
            stdout
              .trim()
              .split("\n")
              .filter(Boolean);

          if (lines.length === 0) {
            return reject(
              new Error(
                "Python returned empty response"
              )
            );
          }

          /*
          Python should return JSON as the
          final output line.
          */

          const lastLine =
            lines[lines.length - 1];

          const result =
            JSON.parse(lastLine);

          console.log(
            "✅ Face search result:",
            result
          );

          resolve(result);

        } catch (error) {
          console.error(
            "❌ Invalid Python JSON:",
            stdout
          );

          reject(
            new Error(
              "Invalid response received from Python face recognition"
            )
          );
        }
      }
    );
  });
}

module.exports = {
  runFaceSearch,
};