<?php

namespace App\Domain\ValueObjects;

enum MemberType: string
{
    case Family = 'family';
    case CramSchool = 'cram_school';
    case Circle = 'circle';
    case PublicFacility = 'public_facility';
    case Other = 'other';
}
