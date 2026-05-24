const WebSocket = require('ws');
const http = require('http');

function fetchCandles(symbol, granularity, count) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1');

    ws.on('open', () => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        style: 'candles',
        granularity: granularity,
        count: count,
        end: 'latest'
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      if (response.candles) {
        resolve(response.candles);
        ws.close();
      } else if (response.error) {
        reject(new Error(response.error.message));
        ws.close();
      }
    });

    ws.on('error', (err) => reject(err.message));
    setTimeout(() => {
      ws.close();
      reject(new Error('timeout'));
    }, 15000);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/candles') {
    try {
      const [data4H, data1H, data15M] = await Promise.all([
        fetchCandles('stpRNG500', 14400, 50),
        fetchCandles('stpRNG500', 3600, 50),
        fetchCandles('stpRNG500', 900, 30)
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data4H, data1H, data15M }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Deriv Candles API running on port ${PORT}`);
});
