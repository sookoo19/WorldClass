<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Validation Language Lines (ja)
    |--------------------------------------------------------------------------
    |
    | バリデーションメッセージの日本語訳。:attribute は attributes 配列で
    | 日本語のフィールド名に置換される。
    |
    */

    'accepted' => ':attribute を承認してください。',
    'active_url' => ':attribute は有効なURLではありません。',
    'after' => ':attribute には :date より後の日付を指定してください。',
    'after_or_equal' => ':attribute には :date 以降の日付を指定してください。',
    'alpha' => ':attribute はアルファベットのみ使用できます。',
    'alpha_dash' => ':attribute はアルファベット・数字・ハイフン・アンダースコアのみ使用できます。',
    'alpha_num' => ':attribute はアルファベットと数字のみ使用できます。',
    'array' => ':attribute は配列でなければなりません。',
    'before' => ':attribute には :date より前の日付を指定してください。',
    'before_or_equal' => ':attribute には :date 以前の日付を指定してください。',
    'between' => [
        'array' => ':attribute は :min 個から :max 個までにしてください。',
        'file' => ':attribute は :min KBから :max KBまでにしてください。',
        'numeric' => ':attribute は :min から :max までにしてください。',
        'string' => ':attribute は :min 文字から :max 文字までにしてください。',
    ],
    'boolean' => ':attribute は true か false を指定してください。',
    'confirmed' => ':attribute が確認用の値と一致しません。',
    'current_password' => 'パスワードが正しくありません。',
    'date' => ':attribute は正しい日付ではありません。',
    'date_equals' => ':attribute には :date と同じ日付を指定してください。',
    'date_format' => ':attribute は :format 形式で指定してください。',
    'different' => ':attribute と :other には異なる値を指定してください。',
    'digits' => ':attribute は :digits 桁で指定してください。',
    'digits_between' => ':attribute は :min 桁から :max 桁で指定してください。',
    'email' => ':attribute は正しいメールアドレス形式で指定してください。',
    'ends_with' => ':attribute は次のいずれかで終わる必要があります: :values',
    'exists' => '選択された :attribute は正しくありません。',
    'file' => ':attribute はファイルを指定してください。',
    'filled' => ':attribute は必須です。',
    'gt' => [
        'array' => ':attribute は :value 個より多くしてください。',
        'file' => ':attribute は :value KBより大きくしてください。',
        'numeric' => ':attribute は :value より大きくしてください。',
        'string' => ':attribute は :value 文字より長くしてください。',
    ],
    'gte' => [
        'array' => ':attribute は :value 個以上にしてください。',
        'file' => ':attribute は :value KB以上にしてください。',
        'numeric' => ':attribute は :value 以上にしてください。',
        'string' => ':attribute は :value 文字以上にしてください。',
    ],
    'image' => ':attribute は画像を指定してください。',
    'in' => '選択された :attribute は正しくありません。',
    'integer' => ':attribute は整数で指定してください。',
    'ip' => ':attribute は正しいIPアドレスを指定してください。',
    'ipv4' => ':attribute は正しいIPv4アドレスを指定してください。',
    'ipv6' => ':attribute は正しいIPv6アドレスを指定してください。',
    'json' => ':attribute は正しいJSON文字列を指定してください。',
    'lt' => [
        'array' => ':attribute は :value 個より少なくしてください。',
        'file' => ':attribute は :value KBより小さくしてください。',
        'numeric' => ':attribute は :value より小さくしてください。',
        'string' => ':attribute は :value 文字より短くしてください。',
    ],
    'lte' => [
        'array' => ':attribute は :value 個以下にしてください。',
        'file' => ':attribute は :value KB以下にしてください。',
        'numeric' => ':attribute は :value 以下にしてください。',
        'string' => ':attribute は :value 文字以下にしてください。',
    ],
    'max' => [
        'array' => ':attribute は :max 個以下にしてください。',
        'file' => ':attribute は :max KB以下にしてください。',
        'numeric' => ':attribute は :max 以下にしてください。',
        'string' => ':attribute は :max 文字以下にしてください。',
    ],
    'mimes' => ':attribute は :values 形式のファイルを指定してください。',
    'mimetypes' => ':attribute は :values 形式のファイルを指定してください。',
    'min' => [
        'array' => ':attribute は :min 個以上にしてください。',
        'file' => ':attribute は :min KB以上にしてください。',
        'numeric' => ':attribute は :min 以上にしてください。',
        'string' => ':attribute は :min 文字以上にしてください。',
    ],
    'not_in' => '選択された :attribute は正しくありません。',
    'not_regex' => ':attribute の形式が正しくありません。',
    'numeric' => ':attribute は数値を指定してください。',
    'password' => [
        'letters' => ':attribute には文字を含めてください。',
        'mixed' => ':attribute には大文字と小文字を含めてください。',
        'numbers' => ':attribute には数字を含めてください。',
        'symbols' => ':attribute には記号を含めてください。',
        'uncompromised' => ':attribute が漏洩したパスワードに含まれています。別のものを指定してください。',
    ],
    'present' => ':attribute が存在していません。',
    'regex' => ':attribute の形式が正しくありません。',
    'required' => ':attribute は必ず指定してください。',
    'required_if' => ':other が :value の場合、:attribute は必須です。',
    'required_unless' => ':other が :values でない場合、:attribute は必須です。',
    'required_with' => ':values が指定されている場合、:attribute は必須です。',
    'required_with_all' => ':values が指定されている場合、:attribute は必須です。',
    'required_without' => ':values が指定されていない場合、:attribute は必須です。',
    'required_without_all' => ':values のいずれも指定されていない場合、:attribute は必須です。',
    'same' => ':attribute と :other は一致する必要があります。',
    'size' => [
        'array' => ':attribute は :size 個にしてください。',
        'file' => ':attribute は :size KBにしてください。',
        'numeric' => ':attribute は :size にしてください。',
        'string' => ':attribute は :size 文字にしてください。',
    ],
    'starts_with' => ':attribute は次のいずれかで始まる必要があります: :values',
    'string' => ':attribute は文字列を指定してください。',
    'timezone' => ':attribute は正しいタイムゾーンを指定してください。',
    'unique' => ':attribute はすでに使用されています。',
    'uploaded' => ':attribute のアップロードに失敗しました。',
    'url' => ':attribute は正しいURL形式で指定してください。',
    'uuid' => ':attribute は正しいUUID形式で指定してください。',

    /*
    |--------------------------------------------------------------------------
    | Custom Validation Attributes
    |--------------------------------------------------------------------------
    |
    | :attribute を日本語のフィールド名に置換する。
    |
    */

    'attributes' => [
        'email' => 'メールアドレス',
        'password' => 'パスワード',
        'password_confirmation' => 'パスワード（確認）',
        'name' => 'お名前',
        'type' => 'ご利用区分',
        'org_name' => '団体名',
        'prefecture' => '都道府県',
        'contact_name' => '連絡担当者名',
        'grade_range' => '対象学年',
        'provider_type' => '提供者区分',
        'display_name' => '表示名',
        'country' => '国',
        'region' => '地域',
        'themes' => 'テーマ',
    ],

];
