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
        Schema::create('session_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained()->cascadeOnDelete();
            $table->enum('status', ['pending', 'confirmed', 'cancelled'])->default('pending');
            $table->string('stripe_payment_id')->nullable();
            $table->unsignedInteger('price_paid');
            $table->unsignedInteger('support_amount'); // price_paidの50%
            $table->text('question_list')->nullable();
            $table->dateTime('question_list_sent_at')->nullable();
            $table->unsignedTinyInteger('rating_score')->nullable();  // ★1-5
            $table->text('rating_comment')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('session_participants');
    }
};
