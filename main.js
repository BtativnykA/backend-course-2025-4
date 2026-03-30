const fs = require('fs');
const http = require('http');
const { Command } = require('commander');
const { XMLBuilder } = require('fast-xml-parser');

const program = new Command();

program
  .requiredOption('-i, --input <path>', 'шлях до файлу JSON')
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера');

program.parse(process.argv);
const options = program.opts();

// Перевірка наявності файлу
if (!fs.existsSync(options.input)) {
  console.error('Cannot find input file');
  process.exit(1);
}

// Створення сервера
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${options.host}:${options.port}`);
  const furnished = url.searchParams.get('furnished') === 'true';
  const maxPrice = url.searchParams.get('max_price');

  // Асинхронне читання файлу
  fs.readFile(options.input, 'utf-8', (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end('Server error');
      return;
    }

    // Розбиваємо на рядки (NDJSON)
    const lines = data.split('\n').filter(line => line.trim() !== '');
    const houses = [];

    for (const line of lines) {
      try {
        const house = JSON.parse(line);

        // Фільтр за furnished
        if (furnished && house.furnishingstatus !== 'furnished') {
          continue;
        }

        // Фільтр за max_price
        if (maxPrice && parseFloat(house.price) >= parseFloat(maxPrice)) {
          continue;
        }

        // Додаємо у результат
        houses.push({
          price: house.price,
          area: house.area,
          furnishingstatus: house.furnishingstatus
        });
      } catch (e) {
        // Ігноруємо невалідні рядки
      }
    }

    // Формуємо XML
    const builder = new XMLBuilder({
      format: true,
      indentBy: '  ',
      ignoreAttributes: false
    });

    const xml = builder.build({
      houses: {
        house: houses
      }
    });

    // Відправляємо відповідь
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(xml);
  });
});

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});