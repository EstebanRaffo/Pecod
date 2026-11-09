import { Controller, Post, Param, Body, HttpCode, UseGuards, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // HU26: POST /courses/:courseId/payments - Procesar pago
  @Post(':courseId/payments')
  @Roles('STUDENT')
  @HttpCode(200)
  async processPayment(
    @Param('courseId') courseId: string,
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() student: AuthenticatedUser,
  ) {
    return this.paymentsService.processPayment(courseId, createPaymentDto, student);
  }

  // HU26: GET /courses/:courseId/payments (opcional, para auditoría)
  @Get(':courseId/payments')
  @Roles('STUDENT', 'PROFESSOR', 'ADMIN')
  async getPaymentHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getPaymentHistory(user);
  }
}
