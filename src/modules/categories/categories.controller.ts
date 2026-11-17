import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireWorkspacePermissions } from '../../common/decorators/workspace-access.decorator.js';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { QueryCategoriesDto } from './dto/query-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar kategori pemasukan & pengeluaran workspace' })
  listCategories(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryCategoriesDto,
  ) {
    return this.categoriesService.listCategories(workspaceId, query);
  }

  @Post()
  @RequireWorkspacePermissions('canManageCategories')
  @ApiOperation({ summary: 'Buat kategori custom baru' })
  createCategory(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.createCategory(workspaceId, user.id, dto);
  }

  @Patch(':categoryId')
  @RequireWorkspacePermissions('canManageCategories')
  @ApiOperation({ summary: 'Ubah nama, ikon, warna, atau arsip kategori' })
  updateCategory(
    @Param('workspaceId') workspaceId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(
      workspaceId,
      categoryId,
      user.id,
      dto,
    );
  }

  @Delete(':categoryId')
  @RequireWorkspacePermissions('canManageCategories')
  @ApiOperation({
    summary: 'Hapus kategori custom (atau arsipkan otomatis jika sudah digunakan)',
  })
  deleteCategory(
    @Param('workspaceId') workspaceId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.deleteOrArchiveCategory(
      workspaceId,
      categoryId,
      user.id,
    );
  }
}

