const http = require("http");

const server = http.createServer((req, res) => {
  res.write("Tulip API Running");
  res.end();
});

server.listen(5050, () => {
  console.log("Server running on port 5050");
});
