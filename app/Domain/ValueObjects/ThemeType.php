<?php

namespace App\Domain\ValueObjects;

enum ThemeType: string
{
    case Culture = 'culture';   // 文化交流
    case English = 'english';   // 英語学習
    case Global = 'global';    // 国際理解
}
