require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());

// Routes
const authRoutes          = require('./routes/authRoutes')
const projectRoutes       = require('./routes/projectRoutes')
const fundingSourceRoutes = require('./routes/fundingSourceRoutes')
const expenseRoutes       = require('./routes/expenseRoutes')
const documentRoutes      = require('./routes/documentRoutes')

app.get("/", (req, res) => {
  res.send("Tulip API Running");
});

app.use('/api/auth',            authRoutes)
app.use('/api/projects',        projectRoutes)
app.use('/api/funding-sources', fundingSourceRoutes)
app.use('/api/expenses',        expenseRoutes)
app.use('/api/documents',       documentRoutes)

app.listen(5050, () => {
  console.log("Server running on port 5050");
});
