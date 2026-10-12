'use client';
import type { Profile } from '@calorie-donate/api';
import { ProfileForm } from './ProfileForm';

export function Onboarding({ onDone }: { onDone: (profile: Profile) => void }) {
  return (
    <section className="onboarding">
      <p className="eyebrow">WELCOME</p>
      <h1>食べすぎた分は、誰かの一食に。</h1>
      <p className="lead">
        Calorie Donate
        は、1日の目標カロリーを超えた分を世界の子どもたちへの寄付に変えるダイエット支援アプリです。
      </p>
      <ol className="steps">
        <li>
          <strong>目標を決める</strong>
          <span>1日の目標カロリーと寄付レートを設定します。</span>
        </li>
        <li>
          <strong>食事を記録する</strong>
          <span>写真を撮るだけでカロリーを自動推定。手入力もできます。</span>
        </li>
        <li>
          <strong>超えた分を寄付</strong>
          <span>
            翌々日に1日分が確定し、目標を超えたカロリーが寄付額として記録されます。
          </span>
        </li>
      </ol>
      <div className="card">
        <h2>はじめの設定</h2>
        <ProfileForm profile={null} submitLabel="はじめる" onSaved={onDone} />
      </div>
    </section>
  );
}
