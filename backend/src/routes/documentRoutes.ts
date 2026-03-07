// ============================================
// Court Access — Document Routes
// ============================================

import { Router } from 'express';
import multer from 'multer';
import { handleUploadDocument, handleListDocuments, handleGetDocument, handleGetDocumentDownloadUrl } from '../controllers/documentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { env } from '../config/env.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, TXT, DOCX'));
    }
  },
});

router.use(authMiddleware);
router.use(tenantMiddleware);

router.post('/case/:caseId/upload', upload.single('file'), handleUploadDocument);
router.get('/case/:caseId', handleListDocuments);
router.get('/:id', handleGetDocument);
router.get('/:id/download', handleGetDocumentDownloadUrl);

export default router;
