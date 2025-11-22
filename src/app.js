require('dotenv').config();
const express = require('express');
const promClient = require('prom-client');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage
let todos = [];
let nextId = 1;

// Middleware
app.use(express.json());

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path'],
  registers: [register]
});

// Request logging with correlation ID
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestCounter.inc({ method: req.method, path: req.path, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, path: req.path }, duration);
    logger.info('HTTP Request', { correlationId, method: req.method, path: req.path, status: res.statusCode, duration: `${duration}s` });
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// GET all todos
app.get('/todos', (req, res) => {
  res.json({ todos, count: todos.length });
});

// GET single todo
app.get('/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === parseInt(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json(todo);
});

// CREATE todo
app.post('/todos', (req, res) => {
  const { title } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const todo = {
    id: nextId++,
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  todos.push(todo);
  logger.info('Todo created', { correlationId: req.correlationId, todoId: todo.id });
  res.status(201).json(todo);
});

// UPDATE todo
app.put('/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === parseInt(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  
  const { title, completed } = req.body;
  if (title !== undefined) todo.title = title;
  if (completed !== undefined) todo.completed = completed;
  
  logger.info('Todo updated', { correlationId: req.correlationId, todoId: todo.id });
  res.json(todo);
});

// DELETE todo
app.delete('/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });
  
  const deleted = todos.splice(index, 1)[0];
  logger.info('Todo deleted', { correlationId: req.correlationId, todoId: deleted.id });
  res.json({ message: 'Todo deleted successfully', todo: deleted });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { correlationId: req.correlationId, error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, { port: PORT, nodeEnv: process.env.NODE_ENV || 'development' });
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;