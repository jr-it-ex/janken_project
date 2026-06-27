  // === XSS Prevention Helper ===
      function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      }

      const $ = (id) => document.getElementById(id);
      const HAND_EMOJI = ["✊", "✌️", "✋"];
      let ws = null;
      let mySubmitted = false;
      let currentTurn = 1;
      let currentRoomId = null;

      // ════════ URL & Screen Detection ════════
      const currentPath = location.pathname;
      const params = new URLSearchParams(location.search);
      const isInMatch = currentPath.includes("/match");
      const codeFromURL = params.get("code")?.toUpperCase() || null;

      // スクリーン切り替え
      function showEntryScreen() {
        $("entry-screen").classList.remove("hidden");
        $("battle-screen").classList.remove("visible");
        document.body.classList.remove("screen-battle");
        $("header-title").textContent = "アルティメットじゃんけん";
        $("header-badge").textContent = "WS ONLINE";
      }

      function showBattleScreen() {
        $("entry-screen").classList.add("hidden");
        $("battle-screen").classList.add("visible");
        document.body.classList.add("screen-battle");
        $("header-title").textContent = "⚔️ 対戦中";
        $("header-badge").textContent = "BATTLE";
      }

      // 初期状態：URLパスによって判定
      if (isInMatch) {
        showBattleScreen();
      } else {
        showEntryScreen();
      }

      // URLパラメータからルームコードを自動入力（Entry画面の場合のみ）
      if (codeFromURL && !isInMatch) {
        $("join-code").value = codeFromURL;
      }

      // ════════ QR・リンク共有URL生成 ════════
      function buildInviteUrl(roomId) {
        const base = `${location.origin}${location.pathname.replace(/\/[^/]*$/, "")}`;
        return `${base}/match?code=${roomId}`;
      }

      // ════════ WebSocket 接続初期化 ════════
      function connectWS() {
        const wsUrl = `wss://janken-project-back.onrender.com/ws`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Entry画面のみステータス更新
          if ($("entry-status")) {
            $("entry-status").textContent = "✅ サーバーに接続しました。";
            $("entry-status").style.color = "var(--green)";
            document
              .querySelectorAll("#entry-section button")
              .forEach((b) => (b.disabled = false));
          }
        };

        ws.onmessage = (e) => {
          const data = JSON.parse(e.data);
          handleMessage(data);
        };

        ws.onclose = () => {
          if ($("entry-status")) {
            $("entry-status").textContent =
              "❌ サーバーとの接続が切れました。リロードしてください。";
            $("entry-status").style.color = "var(--p2)";
            document
              .querySelectorAll("button")
              .forEach((b) => (b.disabled = true));
          }
        };
      }

      // 初期化時、Entry画面のボタンを無効化
      document
        .querySelectorAll("#entry-section button")
        .forEach((b) => (b.disabled = true));
      connectWS();

      // ════════ メッセージハンドリング ════════
      function handleMessage(data) {
        switch (data.type) {
          case "waiting_random":
            $("entry-section").classList.add("hidden");
            $("lobby-section").classList.remove("hidden");
            $("room-code-display").textContent = "RANDOM";
            $("waiting-msg").innerHTML =
              '<div class="icon">🔍</div><div class="text">対戦相手を探しています...</div>';
            $("qr-btn-row").classList.add("hidden");
            break;

          case "room_created":
            $("entry-section").classList.add("hidden");
            $("lobby-section").classList.remove("hidden");
            currentRoomId = data.roomId;
            $("room-code-display").textContent = data.roomId;
            $("qr-btn-row").classList.remove("hidden");
            break;

          case "game_start":
            $("opp-name").textContent = data.oppName;
            $("sc-label-opp").textContent = data.oppName;
            $("waiting-msg").innerHTML =
              '<div class="icon">🎮</div><div class="text">対戦相手が見つかりました！まもなく開始...</div>';
            $("qr-btn-row").classList.add("hidden");
            break;

          case "state_sync":
            showBattleScreen();
            syncState(data.state);
            break;

          case "turn_result":
            resolveResult(data);
            break;

          case "wait_opponent_next":
            $("wait-submit").classList.remove("hidden");
            $("wait-submit").innerHTML =
              '<span class="spinner"></span>相手の準備を待っています...';
            break;

          case "opponent_disconnected":
            alert("対戦相手との接続が切れました。");
            location.reload();
            break;

          case "error":
            if ($("entry-status")) {
              $("entry-status").textContent = "❌ " + data.message;
              $("entry-status").style.color = "var(--p2)";
            }
            break;
        }
      }

      // ════════ 送信アクション ════════
      const getName = () => $("display-name").value.trim() || "Player";

      $("btn-rand-bo1").onclick = () =>
        ws.send(
          JSON.stringify({ type: "join_random", bo: 1, name: getName() }),
        );
      $("btn-rand-bo3").onclick = () =>
        ws.send(
          JSON.stringify({ type: "join_random", bo: 3, name: getName() }),
        );
      $("btn-create-bo1").onclick = () =>
        ws.send(
          JSON.stringify({ type: "create_room", bo: 1, name: getName() }),
        );
      $("btn-create-bo3").onclick = () =>
        ws.send(
          JSON.stringify({ type: "create_room", bo: 3, name: getName() }),
        );

      $("btn-join").onclick = () => {
        const code = $("join-code").value.trim().toUpperCase();
        if (code.length === 6) {
          ws.send(
            JSON.stringify({
              type: "join_room",
              roomId: code,
              name: getName(),
            }),
          );
        } else if ($("entry-status")) {
          $("entry-status").textContent = "6文字のコードを入力してください";
        }
      };

      // ════════ QRコード機能 ════════
      $("show-qr").onclick = () => {
        if (!currentRoomId) return;
        const url = buildInviteUrl(currentRoomId);
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
        $("qr-img").src = qrSrc;
        $("qr-url").textContent = url;
        $("qr-modal").classList.remove("hidden");
      };

      $("close-qr").onclick = () => $("qr-modal").classList.add("hidden");

      $("copy-link").onclick = async () => {
        if (!currentRoomId) return;
        const url = buildInviteUrl(currentRoomId);
        try {
          await navigator.clipboard.writeText(url);
          alert("URLをコピーしました");
        } catch (e) {}
      };

      $("copy-qr-url").onclick = async () => {
        const url = $("qr-url").textContent;
        try {
          await navigator.clipboard.writeText(url);
          alert("URLをコピーしました");
        } catch (e) {}
      };

      $("leave-lobby").onclick = () => location.reload();
      $("leave-game").onclick = () => location.reload();
      $("mo-leave").onclick = () => location.reload();

      // ════════ ゲームプレイ ════════
      function submitHand(hand) {
        if (mySubmitted) return;
        mySubmitted = true;
        document.querySelectorAll(".hand-btn").forEach((btn) => {
          btn.disabled = true;
          if (parseInt(btn.dataset.hand) === hand)
            btn.classList.add("selected");
        });
        ws.send(JSON.stringify({ type: "submit_hand", hand }));
        $("wait-submit").classList.remove("hidden");
        $("wait-submit").innerHTML =
          '<span class="spinner"></span>相手の提出を待っています...';
      }

      document
        .querySelectorAll(".hand-btn")
        .forEach(
          (btn) =>
            (btn.onclick = () =>
              submitHand(parseInt(btn.dataset.hand))),
        );

      // ════════ UI 同期 ════════
      function syncState(state) {
        $("set-over").classList.remove("show");
        $("match-over").classList.remove("show");
        $("my-name").textContent = getName();
        $("sc-label-me").textContent = getName();

        currentTurn = state.turn;
        $("score-me").textContent = state.scores.me;
        $("score-opp").textContent = state.scores.opp;

        if (state.bo > 1) {
          $("sets-info").textContent =
            `SET: ${getName()} ${state.sets.me} - ${state.sets.opp} ${$("opp-name").textContent} (BO${state.bo})`;
        } else {
          $("sets-info").textContent = "";
        }

        if (
          currentTurn === 1 &&
          state.scores.me === 0 &&
          state.scores.opp === 0
        ) {
          $("history-list").innerHTML = "";
        }

        mySubmitted = false;
        const values = state.values[currentTurn - 1] || [1, 2, 3];

        if (state.suddenDeath) {
          $("values-display").classList.add("sd");
          $("values-title").textContent = "SUDDEN DEATH";
          $("values-row").innerHTML =
            '<div class="sd-label">普通のじゃんけん！勝った方が勝ち</div>';
          for (let i = 0; i < 3; i++) $("vb-" + i).style.display = "none";
          document.querySelectorAll(".hand-btn").forEach((btn) => {
            btn.classList.remove("best", "worst", "selected");
            btn.disabled = false;
          });
        } else {
          $("values-display").classList.remove("sd");
          $("values-title").textContent = `TURN ${currentTurn} - VALUES`;
          $("values-row").innerHTML = values
            .map(
              (v, i) =>
                `<div class="val-item"><span class="val-emoji">${escapeHtml(HAND_EMOJI[i])}</span><span class="val-num">${escapeHtml(String(v))}</span></div>`,
            )
            .join("");
          const maxVal = Math.max(...values),
            minVal = Math.min(...values);
          document.querySelectorAll(".hand-btn").forEach((btn) => {
            const h = parseInt(btn.dataset.hand);
            btn.classList.remove("best", "worst", "selected");
            btn.disabled = false;
            if (values[h] === maxVal) btn.classList.add("best");
            if (values[h] === minVal) btn.classList.add("worst");
            $("vb-" + h).textContent = values[h];
            $("vb-" + h).setAttribute("data-val", values[h]);
            $("vb-" + h).style.display = "";
          });
        }

        $("hand-section").classList.remove("hidden");
        $("result-panel").classList.remove("show");
        $("next-btn").classList.add("hidden");
        $("wait-submit").classList.add("hidden");
      }

      // ════════ 結果表示 ════════
      function resolveResult(data) {
        $("wait-submit").classList.add("hidden");
        $("hand-section").classList.add("hidden");

        const {
          myHand,
          oppHand,
          myPts,
          oppPts,
          result,
          suddenDeath,
          isSetOver,
          isMatchOver,
          iWonSet,
          iWonMatch,
          newScores,
        } = data;
        const rh1 = $("res-h1"),
          rh2 = $("res-h2");

        rh1.classList.remove("animate");
        rh2.classList.remove("animate");
        $("res-text").classList.remove("reveal");
        $("res-detail").classList.remove("reveal");
        $("pop-p1").classList.remove("pop");
        $("pop-p1").textContent = "";
        $("pop-p2").classList.remove("pop");
        $("pop-p2").textContent = "";

        rh1.textContent = HAND_EMOJI[myHand];
        rh2.textContent = HAND_EMOJI[oppHand];
        $("result-panel").classList.add("show");

        requestAnimationFrame(() => {
          rh1.classList.add("animate");
          setTimeout(() => rh2.classList.add("animate"), 250);
        });

        setTimeout(() => {
          if (!suddenDeath) {
            if (result === 1 || result === 0) {
              $("pop-p1").textContent = "+" + myPts;
              $("pop-p1").classList.add("pop");
            }
            if (result === -1 || result === 0) {
              $("pop-p2").textContent = "+" + oppPts;
              $("pop-p2").classList.add("pop");
            }
          }
        }, 600);

        setTimeout(() => {
          let resLabel =
            result === 1 ? "WIN!" : result === -1 ? "LOSE" : "DRAW";
          let resClass = result === 1 ? "win" : result === -1 ? "lose" : "draw";
          $("res-text").textContent = resLabel;
          $("res-text").className = "result-text " + resClass + " reveal";

          if (suddenDeath) {
            $("res-detail").textContent =
              result === 0 ? "あいこ！もう一度" : "";
          } else {
            $("res-detail").innerHTML =
              `<span class="pts-you">YOU +${escapeHtml(String(myPts))}</span><span class="pts-sep">/</span><span class="pts-cpu">相手 +${escapeHtml(String(oppPts))}</span>`;
          }
          $("res-detail").classList.add("reveal");

          $("score-me").textContent = newScores.me;
          $("score-opp").textContent = newScores.opp;

          const row = document.createElement("div");
          row.className = "hist-row";
          row.innerHTML = `<span class="hist-turn">T${escapeHtml(String(currentTurn))}</span><span class="hist-hands">${escapeHtml(HAND_EMOJI[myHand])} vs ${escapeHtml(HAND_EMOJI[oppHand])}</span><span class="hist-pts"><span class="p1p">+${escapeHtml(String(myPts))}</span> / <span class="p2p">+${escapeHtml(String(oppPts))}</span></span>`;
          $("history-list").prepend(row);

          if (isMatchOver) {
            setTimeout(() => {
              $("mo-icon").textContent = iWonMatch ? "🏆" : "💀";
              $("mo-msg").textContent = iWonMatch ? "YOU WIN!" : "YOU LOSE";
              $("mo-msg").className =
                "msg " + (iWonMatch ? "p1w" : "p2w");
              $("mo-sub").textContent =
                $("sets-info").textContent ||
                `${newScores.me} - ${newScores.opp}`;
              $("match-over").classList.add("show");
            }, 800);
          } else if (isSetOver) {
            setTimeout(() => {
              $("so-icon").textContent = iWonSet ? "✨" : "😤";
              $("so-msg").textContent = iWonSet ? "SET WIN!" : "SET LOSE";
              $("so-msg").className =
                "msg " + (iWonSet ? "p1w" : "p2w");
              $("so-sub").textContent = `${newScores.me} - ${newScores.opp}`;
              $("set-over").classList.add("show");
            }, 800);
          } else {
            $("next-btn").classList.remove("hidden");
          }
        }, 1300);
      }

      $("next-btn").onclick = () => {
        $("next-btn").classList.add("hidden");
        ws.send(JSON.stringify({ type: "next_turn" }));
      };

      $("so-btn").onclick = () => {
        $("set-over").classList.remove("show");
        ws.send(JSON.stringify({ type: "next_set" }));
      };

      $("mo-rematch").onclick = () => {
        $("match-over").classList.remove("show");
        ws.send(JSON.stringify({ type: "rematch" }));
      };
