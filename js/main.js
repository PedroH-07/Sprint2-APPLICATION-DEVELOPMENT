/* ============================================
   GREENSENSE - Monitoramento da Mata Atlântica
   APIs: Nominatim (OpenStreetMap) e Open-Meteo
   ============================================ */

// Aguarda o DOM carregar completamente antes de executar qualquer código
document.addEventListener('DOMContentLoaded', function() {

    // Elementos do DOM
    var loadBtn = document.getElementById('loadBtn');
    var refreshBtn = document.getElementById('refreshBtn');
    var dashboardGrid = document.getElementById('dashboard-grid');
    var loadingIndicator = document.getElementById('loadingIndicator');
    var errorMessage = document.getElementById('errorMessage');

    // Array para armazenar dados dos pontos monitorados
    var monitoredPoints = [];

    // Event Listeners para botões
    loadBtn.addEventListener('click', iniciarMonitoramento);
    refreshBtn.addEventListener('click', atualizarDados);

    /* ============================================
       Função: Iniciar Monitoramento
       1. Busca pontos geográficos da Mata Atlântica
       2. Obtém dados climáticos para cada ponto
       3. Exibe no dashboard
       ============================================ */
    function iniciarMonitoramento() {
        mostrarCarregamento(true);
        limparErros();

        // Passo 1: Buscar pontos geográficos
        buscarPontosMatAtlantica(function(pontos) {
            if (pontos.length === 0) {
                mostrarErro('Nenhum ponto encontrado. Tente novamente.');
                mostrarCarregamento(false);
                return;
            }

            // Passo 2: Buscar dados climáticos para cada ponto
            obterDadosDosPontos(pontos, 0);
        });
    }

    /* ============================================
       Função: Buscar Pontos via OpenStreetMap
       Requisição para API Nominatim (gratuita)
       ============================================ */
    function buscarPontosMatAtlantica(callback) {
        // URL da API Nominatim com busca por "forest" e "mata atlantica"
        var url = 'https://nominatim.openstreetmap.org/search?q=forest+mata+atlantica&format=json&limit=15';

        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(dados) {
                // Filtrar apenas os 10 primeiros pontos com coordenadas válidas
                var pontosFiltrados = [];
                for (var i = 0; i < dados.length && pontosFiltrados.length < 10; i++) {
                    if (dados[i].lat && dados[i].lon) {
                        pontosFiltrados.push(dados[i]);
                    }
                }
                callback(pontosFiltrados);
            })
            .catch(function(erro) {
                mostrarErro('Erro ao conectar com OpenStreetMap: ' + erro);
                mostrarCarregamento(false);
            });
    }

    /* ============================================
       Função: Obter Dados de Todos os Pontos
       Processa cada ponto sequencialmente
       ============================================ */
    function obterDadosDosPontos(pontos, indiceAtual) {
        // Se já processou todos os pontos, exibir dashboard
        if (indiceAtual >= pontos.length) {
            exibirDashboard(monitoredPoints);
            mostrarCarregamento(false);
            loadBtn.style.display = 'none';
            refreshBtn.style.display = 'inline-block';
            return;
        }

        var pontoAtual = pontos[indiceAtual];

        // Obter dados climáticos do ponto atual
        obterDadosClimaticos(parseFloat(pontoAtual.lat), parseFloat(pontoAtual.lon), function(clima) {
            // FIX: lat/lon convertidos para número com parseFloat
            // FIX: display_name usado como fallback para nome mais descritivo
            monitoredPoints.push({
                nome: pontoAtual.display_name || pontoAtual.name || 'Ponto sem nome',
                lat: parseFloat(pontoAtual.lat),
                lon: parseFloat(pontoAtual.lon),
                clima: clima
            });

            // Pequeno delay (500ms) para respeitar limite de requisições
            setTimeout(function() {
                obterDadosDosPontos(pontos, indiceAtual + 1);
            }, 500);
        });
    }

    /* ============================================
       Função: Obter Dados Climáticos
       Requisição para API Open-Meteo (gratuita)
       ============================================ */
    function obterDadosClimaticos(latitude, longitude, callback) {
        // URL da API Open-Meteo com dados atuais
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude +
                  '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,uv_index&timezone=auto';

        fetch(url)
            .then(function(response) {
                return response.json();
            })
            .then(function(dados) {
                var clima = {
                    temperatura: dados.current.temperature_2m,
                    umidade: dados.current.relative_humidity_2m,
                    precipitacao: dados.current.precipitation,
                    velocidadeVento: dados.current.wind_speed_10m,
                    indiceUV: dados.current.uv_index
                };
                callback(clima);
            })
            .catch(function(erro) {
                mostrarErro('Erro ao obter dados climáticos: ' + erro);
            });
    }

    /* ============================================
       Função: Exibir Dashboard
       Cria cards para todos os pontos monitorados
       ============================================ */
    function exibirDashboard(pontos) {
        dashboardGrid.innerHTML = '';

        for (var i = 0; i < pontos.length; i++) {
            var card = criarCard(pontos[i]);
            dashboardGrid.appendChild(card);
        }
    }

    /* ============================================
       Função: Criar Card Individual
       Retorna um elemento DOM com dados do ponto
       ============================================ */
    function criarCard(ponto) {
        var card = document.createElement('div');
        card.className = 'card';

        var risco = calcularRisco(ponto.clima);

        card.innerHTML =
            '<div class="card-title">📍 ' + ponto.nome + '</div>' +
            '<div class="card-coordinates">Lat: ' + ponto.lat.toFixed(4) + ' | Lon: ' + ponto.lon.toFixed(4) + '</div>' +
            '<div class="weather-data">' +
                '<div class="weather-item">' +
                    '<span class="weather-label">🌡️ Temperatura</span>' +
                    '<span class="weather-value">' + ponto.clima.temperatura.toFixed(1) + '°C</span>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<span class="weather-label">💧 Umidade</span>' +
                    '<span class="weather-value">' + ponto.clima.umidade + '%</span>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<span class="weather-label">🌧️ Precipitação</span>' +
                    '<span class="weather-value">' + ponto.clima.precipitacao.toFixed(2) + ' mm</span>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<span class="weather-label">💨 Velocidade do Vento</span>' +
                    '<span class="weather-value">' + ponto.clima.velocidadeVento.toFixed(1) + ' km/h</span>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<span class="weather-label">☀️ Índice UV</span>' +
                    '<span class="weather-value">' + ponto.clima.indiceUV.toFixed(1) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="risk-status ' + risco.classe + '">' +
                risco.emoji + ' ' + risco.texto +
            '</div>';

        return card;
    }

    /* ============================================
       Função: Calcular Nível de Risco
       Analisa temperatura, umidade, vento e chuva
       ============================================ */
    function calcularRisco(clima) {
        var riscoPontos = 0;

        if (clima.temperatura > 30) riscoPontos = riscoPontos + 2;
        if (clima.temperatura > 35) riscoPontos = riscoPontos + 2;

        if (clima.umidade < 40) riscoPontos = riscoPontos + 2;
        if (clima.umidade < 20) riscoPontos = riscoPontos + 2;

        if (clima.velocidadeVento > 20) riscoPontos = riscoPontos + 2;
        if (clima.velocidadeVento > 30) riscoPontos = riscoPontos + 2;

        if (clima.precipitacao < 1) riscoPontos = riscoPontos + 1;

        if (riscoPontos <= 3) {
            return { classe: 'risk-low', texto: 'Risco Baixo', emoji: '✅' };
        } else if (riscoPontos <= 6) {
            return { classe: 'risk-medium', texto: 'Risco Moderado', emoji: '⚠️' };
        } else {
            return { classe: 'risk-high', texto: 'Risco Alto', emoji: '🚨' };
        }
    }

    /* ============================================
       Função: Atualizar Dados
       Recarrega informações climáticas dos pontos
       ============================================ */
    function atualizarDados() {
        mostrarCarregamento(true);
        limparErros();

        // FIX: salva cópia dos pontos antes de zerar o array
        var pontosParaAtualizar = monitoredPoints.slice();
        monitoredPoints = [];

        // FIX: passa a cópia dos pontos para a função sequencial
        atualizarPontosSequencial(pontosParaAtualizar, 0);
    }

    /* ============================================
       Função: Atualizar Pontos Sequencialmente
       ============================================ */
    function atualizarPontosSequencial(pontos, indice) {
        // FIX: itera sobre a cópia salva, não o array zerado
        if (indice >= pontos.length) {
            exibirDashboard(monitoredPoints);
            mostrarCarregamento(false);
            return;
        }

        var pontoAtual = pontos[indice];

        obterDadosClimaticos(pontoAtual.lat, pontoAtual.lon, function(novoClima) {
            // Reinserir ponto com clima atualizado
            monitoredPoints.push({
                nome: pontoAtual.nome,
                lat: pontoAtual.lat,
                lon: pontoAtual.lon,
                clima: novoClima
            });

            setTimeout(function() {
                atualizarPontosSequencial(pontos, indice + 1);
            }, 500);
        });
    }

    /* ============================================
       Funções Auxiliares
       ============================================ */

    function mostrarCarregamento(visivel) {
        if (visivel) {
            loadingIndicator.style.display = 'block';
        } else {
            loadingIndicator.style.display = 'none';
        }
    }

    function mostrarErro(mensagem) {
        errorMessage.textContent = mensagem;
        errorMessage.style.display = 'block';
    }

    function limparErros() {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }

}); // fim do DOMContentLoaded