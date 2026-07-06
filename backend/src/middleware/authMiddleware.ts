// ============================================================================
// CourtAccess — Auth Middleware (PRODUCTION SAFE)
// ============================================================================

import jwt from "jsonwebtoken";

export async function authMiddleware(request: any, reply: any) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.code(401).send({
        error: "Missing Authorization header",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    if (!token) {
      return reply.code(401).send({
        error: "Invalid Authorization format",
      });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    request.user = {
      id: decoded.id,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };

  } catch (err) {
    console.error("❌ AUTH ERROR:", err);

    return reply.code(401).send({
      error: "Unauthorized",
    });
  }
}
