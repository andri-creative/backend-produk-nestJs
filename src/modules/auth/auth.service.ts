import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import bcrypt from 'bcryptjs';
import { AuthAccount } from '../users/entities/auth-account.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';

const SALT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(UserProfile) private readonly profileModel: typeof UserProfile,
    @InjectModel(AuthAccount) private readonly accountModel: typeof AuthAccount,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterUserDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();

    const existing = await this.userModel.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const name = dto.name?.trim() || email.split('@')[0];
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.userModel.sequelize!.transaction(async (transaction) => {
      const created = await this.userModel.create(
        { name, email, passwordHash, role: 'user' },
        { transaction },
      );

      await this.profileModel.create(
        { userId: created.id, displayName: name },
        { transaction },
      );

      await this.accountModel.create(
        {
          userId: created.id,
          provider: 'local',
          providerAccountId: email,
          email,
        },
        { transaction },
      );

      return created;
    });

    return {
      user: this.toPublicUser(user),
      ...(await this.createAccessToken(user)),
    };
  }

  async login(dto: LoginUserDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase();

    const user = await this.userModel.findOne({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    return {
      user: this.toPublicUser(user),
      ...(await this.createAccessToken(user)),
    };
  }

  private async createAccessToken(
    user: User,
  ): Promise<Pick<AuthResult, 'accessToken' | 'tokenType'>> {
    return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      tokenType: 'Bearer',
    };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
