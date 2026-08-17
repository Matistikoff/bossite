const typingText = document.querySelector("#typing-text");
const name = "mito.boss";
const typeDelay = 120;
const deleteDelay = 70;
const pauseDelay = 1200;

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
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function animate() {
  while (true) {
    await type(name);
    await wait(pauseDelay);
    await erase();
    await type(currentTime());
    await wait(pauseDelay);
    await erase();
  }
}

animate();
