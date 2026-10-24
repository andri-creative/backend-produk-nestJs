import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category) private readonly categoryModel: typeof Category,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    return this.categoryModel.create({
      name: dto.name,
      slug: dto.slug,
      parentId: dto.parentId ?? null,
      icon: dto.icon ?? null,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  async findAll(): Promise<Category[]> {
    return this.categoryModel.findAll({
      include: [{ model: Category, as: 'children' }],
      where: { parentId: null },
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryModel.findByPk(id, {
      include: [
        { model: Category, as: 'children' },
        { model: Category, as: 'parent' },
      ],
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryModel.findByPk(id);
    if (!category) throw new NotFoundException('Category not found');
    await category.update(dto);
    return category;
  }

  async remove(id: string): Promise<void> {
    const category = await this.categoryModel.findByPk(id);
    if (!category) throw new NotFoundException('Category not found');
    await category.destroy();
  }
}
