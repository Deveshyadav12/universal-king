import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './auth.decorators';
import { AuthenticatedUser } from '../users/users.service';

interface RegistrationInput {
  email: string;
  name: string;
  password: string;
  accountType?: 'individual' | 'company';
  companyName?: string;
  inviteCode?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

const COOKIE_NAME = 'hexawave_session';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() body: RegistrationInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      typeof body?.email !== 'string' ||
      typeof body?.name !== 'string' ||
      typeof body?.password !== 'string'
    ) {
      throw new BadRequestException('Email, name, and password are required.');
    }
    const registration = await this.authService.register(
      body.email,
      body.name,
      body.password,
      {
        accountType: body.accountType,
        companyName: body.companyName,
        inviteCode: body.inviteCode,
      },
    );
    const login = await this.authService.login(body.email, body.password);
    this.setSessionCookie(response, login.token);
    return {
      success: true,
      user: registration.user,
      ...(registration.companyInviteCode
        ? { companyInviteCode: registration.companyInviteCode }
        : {}),
    };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
      throw new BadRequestException('Email and password are required.');
    }
    const result = await this.authService.login(body.email, body.password);
    this.setSessionCookie(response, result.token);
    return { success: true, user: result.user };
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, user };
  }

  @Get('company')
  async company(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, company: await this.authService.getCompany(user.id) };
  }

  @Post('company/invite')
  async rotateCompanyInvite(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      ...(await this.authService.rotateCompanyInvite(user.id)),
    };
  }

 private setSessionCookie(response: Response, token: string): void {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: this.authService.getSessionLifetimeSeconds() * 1000,
    path: '/',
  });
}
}
