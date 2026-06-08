<?php

namespace App\Domain\ValueObjects;

enum PartnerStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Suspended = 'suspended';
    case Rejected = 'rejected';
}
