const request = require('supertest');
const app = require('../src/app');

describe('Todo API', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('http_requests_total');
      expect(res.text).toContain('http_request_duration_seconds');
    });
  });

  describe('POST /todos', () => {
    it('should create a new todo', async () => {
      const res = await request(app)
        .post('/todos')
        .send({ title: 'Test todo' });
      
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test todo');
      expect(res.body.completed).toBe(false);
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it('should return 400 if title is missing', async () => {
      const res = await request(app)
        .post('/todos')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Title is required');
    });

    it('should trim whitespace from title', async () => {
      const res = await request(app)
        .post('/todos')
        .send({ title: '  Trimmed  ' });
      
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Trimmed');
    });
  });

  describe('GET /todos', () => {
    it('should return all todos', async () => {
      const res = await request(app).get('/todos');
      expect(res.status).toBe(200);
      expect(res.body.todos).toBeDefined();
      expect(Array.isArray(res.body.todos)).toBe(true);
      expect(res.body.count).toBeDefined();
    });
  });

  describe('GET /todos/:id', () => {
    it('should return a specific todo', async () => {
      const createRes = await request(app)
        .post('/todos')
        .send({ title: 'Specific todo' });
      
      const todoId = createRes.body.id;
      
      const res = await request(app).get(`/todos/${todoId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(todoId);
      expect(res.body.title).toBe('Specific todo');
    });

    it('should return 404 for non-existent todo', async () => {
      const res = await request(app).get('/todos/99999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Todo not found');
    });
  });

  describe('PUT /todos/:id', () => {
    it('should update todo title', async () => {
      const createRes = await request(app)
        .post('/todos')
        .send({ title: 'Original' });
      
      const todoId = createRes.body.id;
      
      const res = await request(app)
        .put(`/todos/${todoId}`)
        .send({ title: 'Updated' });
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('should update todo completion status', async () => {
      const createRes = await request(app)
        .post('/todos')
        .send({ title: 'To complete' });
      
      const todoId = createRes.body.id;
      
      const res = await request(app)
        .put(`/todos/${todoId}`)
        .send({ completed: true });
      
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
    });

    it('should return 404 for non-existent todo', async () => {
      const res = await request(app)
        .put('/todos/99999')
        .send({ completed: true });
      
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /todos/:id', () => {
    it('should delete a todo', async () => {
      const createRes = await request(app)
        .post('/todos')
        .send({ title: 'To delete' });
      
      const todoId = createRes.body.id;
      
      const res = await request(app).delete(`/todos/${todoId}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Todo deleted successfully');
      expect(res.body.todo.id).toBe(todoId);
    });

    it('should return 404 for non-existent todo', async () => {
      const res = await request(app).delete('/todos/99999');
      expect(res.status).toBe(404);
    });

    it('should actually remove todo from list', async () => {
      const createRes = await request(app)
        .post('/todos')
        .send({ title: 'Will be deleted' });
      
      const todoId = createRes.body.id;
      
      await request(app).delete(`/todos/${todoId}`);
      
      const getRes = await request(app).get(`/todos/${todoId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Correlation ID', () => {
    it('should return correlation ID in response headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-correlation-id']).toBeDefined();
    });

    it('should use provided correlation ID', async () => {
      const correlationId = 'test-correlation-id';
      const res = await request(app)
        .get('/health')
        .set('X-Correlation-ID', correlationId);
      
      expect(res.headers['x-correlation-id']).toBe(correlationId);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const res = await request(app).get('/non-existent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Route not found');
    });
  });
});