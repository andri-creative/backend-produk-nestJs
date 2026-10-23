import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthAccount } from './entities/auth-account.entity';
import { User, UserRole } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface ProfileView {
  id: string;
  userId: string;
  displayName: string;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountView {
  id: string;
  provider: string;
  providerAccountId: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  profile: ProfileView | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(UserProfile) private readonly profileModel: typeof UserProfile,
    @InjectModel(AuthAccount) private readonly accountModel: typeof AuthAccount,
  ) {}

  async getMe(userId: string): Promise<UserDetail> {
    const user = await this.userModel.findByPk(userId, {
      include: [UserProfile, AuthAccount],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserDetail(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileView> {
    const user = await this.userModel.findByPk(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.profileModel.findOne({ where: { userId } });

    if (profile) {
      await profile.update({
        displayName: dto.displayName ?? profile.displayName,
        phone: dto.phone ?? profile.phone,
        bio: dto.bio ?? profile.bio,
        avatarUrl: dto.avatarUrl ?? profile.avatarUrl,
        location: dto.location ?? profile.location,
      });

      return this.toProfileView(profile);
    }

    const created = await this.profileModel.create({
      userId,
      displayName: dto.displayName ?? user.name,
      phone: dto.phone ?? null,
      bio: dto.bio ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      location: dto.location ?? null,
    });

    return this.toProfileView(created);
  }

  async listAccounts(userId: string): Promise<AccountView[]> {
    const accounts = await this.accountModel.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']],
    });

    return accounts.map((account) => this.toAccountView(account));
  }

  private toUserDetail(user: User): UserDetail {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      profile: user.profile ? this.toProfileView(user.profile) : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toProfileView(profile: UserProfile): ProfileView {
    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      phone: profile.phone,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      location: profile.location,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  private toAccountView(account: AuthAccount): AccountView {
    return {
      id: account.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      email: account.email,
      avatarUrl: account.avatarUrl,
      createdAt: account.createdAt,
    };
  }
}
