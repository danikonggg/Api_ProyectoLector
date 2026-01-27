/**
 * ============================================
 * GUARD: JwtAuthGuard
 * ============================================
 * 
 * Guard que protege rutas requiriendo un token JWT válido.
 * Se usa con el decorador @UseGuards(JwtAuthGuard)
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
