const express = require('express');
const bodyParser = require('body-parser');
const { askGrimoire } = require('./core/grimoire');
const { executeCode } = require('./plugins/deepseek');
const app = express();
app.use(bodyParser.json());

app.post('/ask', async (req, res) => {
  const { message } = req.body;
  const reply = await askGrimoire(message);
  res.json({ reply });
});

app.post('/code', async (req, res) => {
  const { code } = req.body;
  const result = await executeCode(code);
  res.json({ result });
});

app.listen(3000, () => {
  console.log('Grimrold v9.5 работает на http://localhost:3000');
});