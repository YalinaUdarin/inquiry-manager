// /api/inquiries: every route here requires a signed-in user.
// Routes only parse input and shape responses; the rules live in
// services/inquiries.service.js and domain/status.js.

const { Router } = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { validateUuid } = require('../middleware/validateUuid');
const {
  createInquirySchema,
  listQuerySchema,
  statusChangeSchema,
} = require('../validation/schemas');
const inquiries = require('../services/inquiries.service');

const router = Router();

// Applies to every route below: no session → 401 before anything else runs.
router.use(requireAuth);

// GET /api/inquiries?status=&q=&page=&pageSize=
router.get('/', async (req, res) => {
  const filters = listQuerySchema.parse(req.query);
  res.json(await inquiries.list(req.user, filters));
});

// POST /api/inquiries  { customerName, contact, subject, description }
router.post('/', async (req, res) => {
  const data = createInquirySchema.parse(req.body ?? {});
  const inquiry = await inquiries.create(req.user, data);
  res.status(201).location(`/api/inquiries/${inquiry.id}`).json({ inquiry });
});

// GET /api/inquiries/:id
router.get('/:id', validateUuid('id'), async (req, res) => {
  res.json({ inquiry: await inquiries.getById(req.user, req.params.id) });
});

// PATCH /api/inquiries/:id/status  { status, version }
router.patch('/:id/status', validateUuid('id'), async (req, res) => {
  const change = statusChangeSchema.parse(req.body ?? {});
  res.json({ inquiry: await inquiries.changeStatus(req.user, req.params.id, change) });
});

module.exports = router;
