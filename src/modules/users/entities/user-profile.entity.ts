import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from 'sequelize';
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { User } from './user.entity';

@Table({
  tableName: 'user_profiles',
  underscored: true,
  timestamps: true,
})
export class UserProfile extends Model<
  InferAttributes<UserProfile>,
  InferCreationAttributes<UserProfile>
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: CreationOptional<string>;

  @Unique
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare displayName: string;

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare phone: CreationOptional<string | null>;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare bio: CreationOptional<string | null>;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare avatarUrl: CreationOptional<string | null>;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare location: CreationOptional<string | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  @BelongsTo(() => User)
  declare user?: NonAttribute<User>;
}
