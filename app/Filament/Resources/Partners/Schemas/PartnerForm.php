<?php

namespace App\Filament\Resources\Partners\Schemas;

use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class PartnerForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('display_name')
                    ->label('名称')
                    ->required(),
                Select::make('provider_type')
                    ->label('提供者種別')
                    ->options([
                        'overseas_school' => '海外校',
                        'local_japanese' => '現地日本人',
                    ])
                    ->required(),
                TextInput::make('country')->label('国')->required(),
                TextInput::make('region')->label('地域')->required(),
                TextInput::make('contact_name')->label('担当者名')->required(),
                TextInput::make('video_url')->label('VTR URL')->url(),
                Select::make('status')
                    ->label('審査ステータス')
                    ->options([
                        'pending' => '審査中',
                        'approved' => '承認',
                        'suspended' => '停止',
                        'rejected' => '不承認',
                    ])
                    ->default('pending')
                    ->required(),
                CheckboxList::make('themes')
                    ->label('テーマ')
                    ->options([
                        'culture' => '文化交流',
                        'english' => '英語学習',
                        'global' => '国際理解',
                    ]),
                TextInput::make('grade_range')->label('対象学年')->required(),
                TextInput::make('support_pool')
                    ->label('物資支援プール(円)')
                    ->numeric()
                    ->disabled(),
            ]);
    }
}
