const typingText = document.querySelector("#typing-text");
// Keep "mito.boss" first; all following entries display in a random order.
// Use "{time}" or "{day}" for live values.
const messages = ["mito.boss", "{time}", "liubov", "<3", "vim" , "zuberec", "fei" , "hasicky zbor", "x230", "air frajer", "{days}", "gitara", "koniferka", "mamka", "skateboard", "pivo", "minolta", "kino", "box", "unity", "java", "angular", "Linux", "Bono", "jak blazen", "heft", "breaking bad", "maind", "kratom", "csgo", "casio", "ween", "sennheiser", "gramofon", "cigo bigo", "zatim", "tutac", "sprcha", "budafinska"];
const typeDelay = 120;
const deleteDelay = 70;
const pauseDelay = 1200;
const days = [
  "nedela",
  "pondelok",
  "utorok",
  "streda",
  "stvrtok",
  "piatok",
  "sobota",
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function type(text) {
  for (let index = 1; index <= text.length; index += 1) {
    typingText.textContent = text.slice(0, index);
    await wait(typeDelay);
  }
}

async function erase() {
  while (typingText.textContent.length) {
    typingText.textContent = typingText.textContent.slice(0, -1);
    await wait(deleteDelay);
  }
}

function currentTime() {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function currentDay() {
  return days[new Date().getDay()];
}

function messageText(message) {
  if (message === "{time}") return currentTime();
  if (message === "{day}" || message === "{days}") return currentDay();

  return message;
}

function shuffledMessages() {
  const randomMessages = messages.slice(1);

  for (let index = randomMessages.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [randomMessages[index], randomMessages[randomIndex]] = [
      randomMessages[randomIndex],
      randomMessages[index],
    ];
  }

  return [messages[0], ...randomMessages];
}

async function animate() {
  while (true) {
    for (const message of shuffledMessages()) {
      await type(messageText(message));
      await wait(pauseDelay);
      await erase();
    }
  }
}

animate();
