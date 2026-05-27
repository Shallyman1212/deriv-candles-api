const WebSocket = require('ws');
const http = require('http');

const SYMBOL = 'stpRNG5';

function derivRequest(request) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1');

    ws.on('open', () => {
      ws.send(JSON.stringify(request));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      if (response.error) {
        reject(new Error(response.error.message));
        ws.close();
      } else {
        resolve(response);
        ws.close();
      }
    });

    ws.on('error', (err) => reject(new Error(err.message)));
    setTimeout(() => {
      ws.close();
      reject(new Error('timeout'));
    }, 15000);
  });
}

async function fetchCandles(granularity, count) {
  const response = await derivRequest({
    ticks_history: SYMBOL,
    style: 'candles',
    granularity: granularity,
    count: count,
    end: 'latest'
  });
  return response.candles || [];
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/candles') {
    try {
      const [data4H, data1H, data15M] = await Promise.all([
  fetchCandles(14400, 30),
  fetchCandles(3600, 24),
  fetchCandles(900, 32)
]);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        symbol: SYMBOL,
        data4H,
        data1H,
        data15M
      }));

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
