import { Controller, Get, Param, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CertificatesService } from './certificates.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller('courses/:courseId/certificate')
export class CertificatesController {
  constructor(private certificatesService: CertificatesService) {}

  @Get('status')
  getStatus(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.getStatus(courseId, user);
  }

  @Get()
  async download(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, code } = await this.certificatesService.download(courseId, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificado-${code}.pdf"`,
    });
    return new StreamableFile(buffer);
  }
}
