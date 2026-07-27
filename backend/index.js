//require("dotenv").config();

const app = require("./src/app");

app.listen(8000, () => {
    console.log("server started on port 8000");
});

const fs = require("fs");
const path = require("path");

const uploads = path.join(__dirname, "src/uploads/logos");

console.log("Uploads exists:", fs.existsSync(uploads));

if (fs.existsSync(uploads)) {
    console.log("Files:", fs.readdirSync(uploads));
}
