<?php

namespace App\Domain\ValueObjects;

enum ProviderType: string
{
    case OverseasSchool = 'overseas_school';
    case LocalJapanese = 'local_japanese';
}
