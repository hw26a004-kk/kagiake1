import React from 'react';
import { BookOpen, Key, AlertTriangle, HelpCircle, Check, Award, Compass, Eye } from 'lucide-react';

export const Instructions: React.FC = () => {
  return (
    <div className="bg-zinc-950 border border-zinc-850 rounded p-5 md:p-6 shadow-xl flex flex-col gap-6 font-sans" id="instructions-container">
      
      <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
        <div className="p-2 bg-amber-950/20 text-amber-500 rounded-sm">
          <BookOpen size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wider text-zinc-200 uppercase font-serif">開錠技術（ロックピック）入門書</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">鍵穴の内なる声を聞き、シリンダーの束縛を解き放つための手引き</p>
        </div>
      </div>

      {/* Main Column Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-300">
        
        {/* Style A: Skyrim-style */}
        <div className="flex flex-col gap-3.5 bg-zinc-900/10 border border-zinc-850/75 p-4 rounded">
          <h3 className="text-xs font-semibold text-amber-200/90 flex items-center gap-1.5 uppercase tracking-wide">
            <Compass size={13} /> スタイル1：シリンダー傾斜回転式 (Skyrim/Fallout風)
          </h3>
          <p className="text-zinc-500 text-xs leading-relaxed">
            もっとも直感的でスピーディな開錠術。テンションを加えながら、ピックの正確な角度（スイートスポット）を手先の感覚だけで探り当てます。
          </p>
          
          <ul className="space-y-2 text-zinc-400 mt-1">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-zinc-300">ピックを傾ける:</strong> マウスの移動（または下のスライダー/キーボードの矢印キー）でピックを任意の角度に傾けます。
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-zinc-300">圧力を加える:</strong> <strong className="text-amber-100">[スペースキー]</strong>または<strong className="text-amber-100">[テンションをかける]ボタン</strong>を押し続けて、シリンダーを回転させます。
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-zinc-300">手応えを感じる:</strong> 正しい角度から外れている場合、シリンダーはある一定の角度でロックされ、それ以上回らなくなります（ピックが激しく振動します）。
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">4</span>
              <div>
                <strong className="text-zinc-300">即座にテンションを離す:</strong> 振動している間、ピックは著しいダメージを受け、限界を超えると折れてしまいます。即座にテンションキーを離してください。
              </div>
            </li>
          </ul>

          <div className="mt-2 text-[10px] bg-amber-950/10 border border-amber-900/35 text-amber-200 p-2.5 rounded flex items-start gap-1.5 leading-relaxed">
            <Eye size={13} className="shrink-0 mt-0.5 text-amber-400" />
            <span>
              <strong>透視補助 (X-Ray):</strong> 最初から位置を掴むのが難しい場合は、画面右上の「シリンダー透視」アイコンを押すことで、スイートスポットがオレンジ色のサークルとして視覚化されます。
            </span>
          </div>
        </div>

        {/* Style B: Pin Tumbler */}
        <div className="flex flex-col gap-3.5 bg-zinc-900/10 border border-zinc-850/75 p-4 rounded">
          <h3 className="text-xs font-semibold text-amber-200/95 flex items-center gap-1.5 uppercase tracking-wide">
            <Key size={13} /> スタイル2：ピンタンブラー式 (リアルパズル風)
          </h3>
          <p className="text-zinc-500 text-xs leading-relaxed">
            実際の鍵師が用いる本格的な開錠術。シリンダー内部のカットモデルを見ながら、5つの小さなピンを一本ずつ剪断線 (シアライン) まで押し上げて噛み合わせます。
          </p>

          <ul className="space-y-2 text-zinc-400 mt-1">
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-zinc-300">接触位置を合わせる:</strong> 「挿入深度スライダー」を使って、探るピン (1〜5) を選択します。
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-zinc-300">ピンを持ち上げる:</strong> 「押し上げ力スライダー」をゆっくりと上にドラッグして、ピンを押し上げていきます。
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-zinc-300">硬いピンを探す (重要):</strong> 鍵にかかっている回転圧により、5つのうち<strong className="text-zinc-350">「常に1本だけ」</strong>が非常に頑丈に固まっています（バインディングピン）。
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-zinc-900 text-zinc-500 text-[9px] font-mono flex items-center justify-center shrink-0 mt-0.5">4</span>
              <div>
                <strong className="text-zinc-300">カチッとはめ込む:</strong> 硬いピンの目印として、押し上げ時に光るエフェクトが出ます。これを適切な高さまで持ち上げると、「カチッ」と鳴って設定完了（SET）となります。これを5本の正しい順番で行います。
              </div>
            </li>
          </ul>

          <div className="mt-2 text-[10px] bg-rose-950/10 border border-rose-900/30 text-rose-300 p-2.5 rounded flex items-start gap-1.5 leading-relaxed">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-rose-500" />
            <span>
              <strong>注意（押し込みすぎ）:</strong> ピンを正しい位置（シアライン）よりも高く持ち上げすぎてしまうと、シリンダーが詰まり、ピックが金属疲労を起こします。
            </span>
          </div>
        </div>

      </div>

      <div className="flex justify-around items-center bg-[#09090b] p-4 rounded text-center border border-zinc-850">
        <div>
          <p className="text-[10px] text-zinc-500 font-mono uppercase">Novice</p>
          <p className="text-xs font-bold text-zinc-300 mt-1">許容角：12°〜16°</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">非常に優しく、破損しにくい</p>
        </div>
        <div className="w-px h-6 bg-zinc-900" />
        <div>
          <p className="text-[10px] text-zinc-500 font-mono uppercase">Adept</p>
          <p className="text-xs font-bold text-zinc-300 mt-1">許容角：6°</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">標準的な緊張感、中難度</p>
        </div>
        <div className="w-px h-6 bg-zinc-900" />
        <div>
          <p className="text-[10px] text-zinc-500 font-mono uppercase">Master</p>
          <p className="text-xs font-bold text-zinc-300 mt-1 text-amber-500/80">許容角：1.5°</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">超極小ポイント、即破損リスク</p>
        </div>
      </div>
    </div>
  );
};
