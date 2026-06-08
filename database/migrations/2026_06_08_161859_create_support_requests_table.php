<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('support_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
            $table->json('item_list'); // 申請内容 [{name,quantity, unit_price}]
            $table->unsignedInteger('claimed_amount_jpy'); // 領収書記載の申請額
            $table->string('receipt_photo_url'); // 領収書写真(証拠の核、必須)
            $table->enum('status', ['pending', 'approved', 'rejected', 'paid'])->default('pending');
            $table->unsignedInteger('approved_amount_jpy')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->dateTime('reviewed_at')->nullable();
            $table->dateTime('paid_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('support_requests');
    }
};
