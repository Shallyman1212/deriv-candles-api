const WebSocket = require('ws');
const http = require('http');

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

async function findStepIndex500Symbol() {
  const response = await derivRequest({ active_symbols: 'brief', product_type: 'basic' });
  const symbols = response.active_symbols || [];
  const stepIndex = symbols.find(s =>
    s.display_name && s.display_name.toLowerCase().includes('step index 500') ||
    s.symbol && s.symbol.toLowerCase().includes('step') && s.symbol.includes('500')
  );
  return stepIndex ? stepIndex.symbol : null;
}

async function fetchCandles(symbol, granularity, count) {
  const response = await derivRequest({
    ticks_history: symbol,
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
      const symbol = await findStepIndex500Symbol();
      if (!symbol) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Step Index 500 symbol not found' }));
        return;
      }

      const [data4H, data1H, data15M] = await Promise.all([
        fetchCandles(symbol, 14400, 50),
        fetchCandles(symbol, 3600, 50),
        fetchCandles(symbol, 900, 30)
      ]);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ symbol, data4H, data1H, data15M }));

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }

  } else if (req.url === '/symbols') {
    try {
      const response = await derivRequest({ active_symbols: 'brief', product_type: 'basic' });
      const stepSymbols = (response.active_symbols || []).filter(s =>
        s.display_name && s.display_name.toLowerCase().includes('step')
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stepSymbols));
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
