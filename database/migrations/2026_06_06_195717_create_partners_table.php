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
        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider_type');
            $table->string('display_name'); // 校名 or 活動者名
            $table->string('country'); // 例: "ケニア"
            $table->string('region');
            $table->string('contact_name');
            $table->string('video_url')->nullable();
            $table->string('status')->default('pending');
            $table->decimal('rating_score', 3, 2)->default(0);
            $table->unsignedInteger('penalty_count')->default(0);
            $table->unsignedInteger('support_pool')->default(0); // 物資支援プール(円)
            $table->json('themes')->nullable(); // ThemeType値の配列
            $table->string('grade_range');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('partners');
    }
};
