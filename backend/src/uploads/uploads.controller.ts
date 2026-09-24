import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UploadsService } from './uploads.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSOR)
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('presigned-url')
  requestUploadUrl(@Body() dto: RequestUploadUrlDto) {
    return this.uploadsService.requestUploadUrl(dto);
  }
}
