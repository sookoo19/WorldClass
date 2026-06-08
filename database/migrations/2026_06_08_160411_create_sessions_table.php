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
        Schema::create('sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained()->cascadeOnDelete();
            $table->enum('session_type', ['private', 'open']);
            $table->dateTime('scheduled_at');
            $table->unsignedInteger('duration_min'); // 45 or 60
            $table->string('theme'); // ThemeType値
            $table->unsignedInteger('capacity'); // 専用=1, オープン=N
            $table->unsignedInteger('min_groups')->default(1);
            $table->boolean('with_facilitator')->default(false);
            $table->unsignedInteger('price_jpy');
            $table->enum('status', ['draft', 'open', 'confirmed', 'ready', 'completed', 'cancelled'])->default('draft');
            $table->dateTime('ready_checked_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sessions');
    }
};
