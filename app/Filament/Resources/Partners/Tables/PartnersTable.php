<?php

namespace App\Filament\Resources\Partners\Tables;

use App\Domain\ValueObjects\PartnerStatus;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class PartnersTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('display_name')->label('名称')->searchable(),
                TextColumn::make('provider_type')->label('種別')->badge(),
                TextColumn::make('country')->label('国')->searchable(),
                TextColumn::make('status')
                    ->label('審査')
                    ->badge()
                    ->formatStateUsing(fn (PartnerStatus $state): string => match ($state) {
                        PartnerStatus::Pending => '審査中',
                        PartnerStatus::Approved => '承認',
                        PartnerStatus::Suspended => '停止',
                        PartnerStatus::Rejected => '不承認',
                    })
                    ->color(fn (PartnerStatus $state): string => match ($state) {
                        PartnerStatus::Pending => 'warning',
                        PartnerStatus::Approved => 'success',
                        PartnerStatus::Suspended, PartnerStatus::Rejected => 'danger',
                    }),
                TextColumn::make('rating_score')->label('★')->numeric()->sortable(),
                TextColumn::make('penalty_count')->label('違反')->numeric()->sortable(),
                TextColumn::make('support_pool')->label('支援プール')->numeric()->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('審査ステータス')
                    ->options([
                        'pending' => '審査中',
                        'approved' => '承認',
                        'suspended' => '停止',
                        'rejected' => '不承認',
                    ]),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
