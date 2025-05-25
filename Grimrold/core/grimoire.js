let memory = [];

async function askGrimoire(message) {
  memory.push({ role: 'user', content: message });
  const reply = `Grimoire: вы сказали "${message}". Я вас понял.`;
  memory.push({ role: 'assistant', content: reply });
  return reply;
}

module.exports = { askGrimoire };