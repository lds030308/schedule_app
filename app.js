const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const VALID_STATUSES = ['진행중', '완료'];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

function parsePositiveInt(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return null;
  }
  const num = Number(value.trim());
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStatusPage(res, statusCode, title, message) {
  res.status(statusCode).send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - MY SCHEDULE</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="container">
    <header class="page-header">
      <div>
        <h1 class="site-title"><a href="/">MY SCHEDULE</a></h1>
        <p class="site-subtitle">${escapeHtml(title)}</p>
      </div>
      <a href="/" class="btn btn-secondary">메인으로</a>
    </header>
    <div class="alert alert-error">${escapeHtml(message)}</div>
  </div>
</body>
</html>`);
}

async function fetchCategories() {
  const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY id ASC');
  return rows;
}

async function fetchScheduleById(id) {
  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.content, s.schedule_date, s.status, s.category_id, s.created_at,
            c.name AS category_name
     FROM schedules s
     LEFT JOIN categories c ON s.category_id = c.id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
}

function validateScheduleInput(body, categories, { requireStatus = false } = {}) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const scheduleDate = typeof body.schedule_date === 'string' ? body.schedule_date.trim() : '';
  const rawCategoryId = typeof body.category_id === 'string' ? body.category_id.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '진행중';

  if (!title) {
    return { error: '일정 제목을 입력해 주세요.' };
  }
  if (title.length > 100) {
    return { error: '일정 제목은 100자 이하로 입력해 주세요.' };
  }
  if (!isValidDateString(scheduleDate)) {
    return { error: '올바른 일정 날짜를 선택해 주세요.' };
  }

  let categoryId = null;
  if (rawCategoryId !== '') {
    categoryId = parsePositiveInt(rawCategoryId);
    const validCategoryIds = new Set(categories.map((c) => c.id));
    if (!categoryId || !validCategoryIds.has(categoryId)) {
      return { error: '유효한 카테고리를 선택해 주세요.' };
    }
  }

  if (requireStatus && !VALID_STATUSES.includes(status)) {
    return { error: '유효한 진행 상태를 선택해 주세요.' };
  }

  return {
    data: {
      title,
      content: content || null,
      scheduleDate,
      categoryId,
      status: requireStatus ? status : '진행중',
    },
  };
}

app.get('/', async (req, res, next) => {
  try {
    const categories = await fetchCategories();
    const rawCategory = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const selectedCategoryId = rawCategory ? parsePositiveInt(rawCategory) : null;

    let sql = `
      SELECT s.id, s.title, s.content, s.schedule_date, s.status, s.category_id, s.created_at,
             c.name AS category_name
      FROM schedules s
      LEFT JOIN categories c ON s.category_id = c.id
    `;
    const params = [];

    if (selectedCategoryId) {
      sql += ' WHERE s.category_id = ?';
      params.push(selectedCategoryId);
    }

    sql += ' ORDER BY s.schedule_date ASC, s.id ASC';

    const [schedules] = await pool.query(sql, params);
    res.render('index', { schedules, categories, selectedCategoryId });
  } catch (err) {
    next(err);
  }
});

app.get('/add', async (req, res, next) => {
  try {
    const categories = await fetchCategories();
    res.render('add', {
      categories,
      error: null,
      formData: { title: '', content: '', schedule_date: '', category_id: '' },
    });
  } catch (err) {
    next(err);
  }
});

app.post('/add', async (req, res, next) => {
  try {
    const categories = await fetchCategories();
    const { error, data } = validateScheduleInput(req.body, categories);

    if (error) {
      return res.status(400).render('add', {
        categories,
        error,
        formData: {
          title: req.body.title || '',
          content: req.body.content || '',
          schedule_date: req.body.schedule_date || '',
          category_id: req.body.category_id || '',
        },
      });
    }

    await pool.query(
      `INSERT INTO schedules (title, content, schedule_date, status, category_id)
       VALUES (?, ?, ?, ?, ?)`,
      [data.title, data.content, data.scheduleDate, data.status, data.categoryId]
    );

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.get('/edit/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return renderStatusPage(res, 404, '일정을 찾을 수 없습니다', '요청하신 일정 ID가 올바르지 않습니다.');
    }

    const [schedule, categories] = await Promise.all([
      fetchScheduleById(id),
      fetchCategories(),
    ]);

    if (!schedule) {
      return renderStatusPage(res, 404, '일정을 찾을 수 없습니다', '존재하지 않거나 이미 삭제된 일정입니다.');
    }

    res.render('edit', {
      schedule,
      categories,
      statuses: VALID_STATUSES,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

app.post('/edit/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return renderStatusPage(res, 404, '일정을 찾을 수 없습니다', '요청하신 일정 ID가 올바르지 않습니다.');
    }

    const [existing, categories] = await Promise.all([
      fetchScheduleById(id),
      fetchCategories(),
    ]);

    if (!existing) {
      return renderStatusPage(res, 404, '일정을 찾을 수 없습니다', '존재하지 않거나 이미 삭제된 일정입니다.');
    }

    const { error, data } = validateScheduleInput(req.body, categories, { requireStatus: true });

    if (error) {
      return res.status(400).render('edit', {
        schedule: {
          id,
          title: req.body.title || '',
          content: req.body.content || '',
          schedule_date: req.body.schedule_date || '',
          category_id: req.body.category_id || '',
          status: req.body.status || existing.status,
        },
        categories,
        statuses: VALID_STATUSES,
        error,
      });
    }

    await pool.query(
      `UPDATE schedules
       SET title = ?, content = ?, schedule_date = ?, status = ?, category_id = ?
       WHERE id = ?`,
      [data.title, data.content, data.scheduleDate, data.status, data.categoryId, id]
    );

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.post('/delete/:id', async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return renderStatusPage(res, 404, '일정을 찾을 수 없습니다', '요청하신 일정 ID가 올바르지 않습니다.');
    }

    const [result] = await pool.query('DELETE FROM schedules WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return renderStatusPage(res, 404, '일정을 찾을 수 없습니다', '존재하지 않거나 이미 삭제된 일정입니다.');
    }

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  renderStatusPage(res, 404, '페이지를 찾을 수 없습니다', '요청하신 페이지가 존재하지 않습니다.');
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  renderStatusPage(
    res,
    500,
    '서버 오류가 발생했습니다',
    '데이터베이스 연결 또는 요청 처리 중 문제가 발생했습니다. MySQL 설정을 확인해 주세요.'
  );
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`MY SCHEDULE server is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
