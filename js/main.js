// GREENSENSE - Monitoramento de Clima da Mata Atlântica
// Integração com as APIs Nominatim (OpenStreetMap) e Open-Meteo

document.addEventListener('DOMContentLoaded', function() {

    // Seleção dos elementos da interface
    var loadBtn = document.getElementById('loadBtn');
    var refreshBtn = document.getElementById('refreshBtn');
    var dashboardGrid = document.getElementById('dashboard-grid');
    var loadingIndicator = document.getElementById('loadingIndicator');
    var errorMessage = document.getElementById('errorMessage');

    // Armazena os dados processados que serão exibidos nos cards
    var monitoredPoints = [];

    // Vincula as ações do usuário aos botões
    if (loadBtn) loadBtn.addEventListener('click', iniciarMonitoramento);
    if (refreshBtn) refreshBtn.addEventListener('click', atualizarDados);

    // Dispara o fluxo principal de coleta de dados
    function iniciarMonitoramento() {
        mostrarCarregamento(true);
        limparErros();

        // Busca a geolocalização dos parques para depois consultar o clima
        buscarPontosMatAtlantica(function(pontos) {
            if (pontos.length === 0) {
                mostrarErro('Nenhum ponto encontrado. Tente novamente.');
                mostrarCarregamento(false);
                return;
            }

            // Inicia a consulta climática a partir do primeiro ponto encontrado
            obterDadosDosPontos(pontos, 0);
        });
    }

    // Consulta o OpenStreetMap para obter latitude e longitude dos locais
    function buscarPontosMatAtlantica(callback) {
        // Lista com margem de segurança. O script para assim que conseguir 10 pontos válidos.
        var buscas = [
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+de+Itatiaia&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+da+Serra+dos+Orgaos&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Estadual+da+Serra+do+Mar&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+da+Tijuca&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+do+Iguacu&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Reserva+Biologica+de+Una&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Estadual+da+Cantareira&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+da+Serra+da+Bocaina&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+do+Caparao&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+do+Monte+Pascoal&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Estadual+Intervales&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Estadual+da+Serra+do+Tabuleiro&format=json&limit=1',
            'https://nominatim.openstreetmap.org/search?q=Parque+Nacional+de+Superagui&format=json&limit=1'
        ];

        var pontosFiltrados = [];
        var buscaAtual = 0;

        // Processa as requisições sequencialmente para respeitar a política de uso da API
        function executarBusca() {
            if (pontosFiltrados.length >= 10 || buscaAtual >= buscas.length) {
                callback(pontosFiltrados.slice(0, 10));
                return;
            }

            fetch(buscas[buscaAtual])
                .then(function(response) {
                    return response.json();
                })
                .then(function(dados) {
                    // Valida o retorno e evita nomes duplicados na lista
                    for (var i = 0; i < dados.length && pontosFiltrados.length < 10; i++) {
                        if (dados[i].lat && dados[i].lon) {
                            var jaTem = false;
                            for (var j = 0; j < pontosFiltrados.length; j++) {
                                if (pontosFiltrados[j].display_name === dados[i].display_name) {
                                    jaTem = true;
                                    break;
                                }
                            }
                            if (!jaTem) {
                                pontosFiltrados.push(dados[i]);
                            }
                        }
                    }
                    buscaAtual++;
                    setTimeout(executarBusca, 1000); // Intervalo de 1 segundo entre as chamadas
                })
                .catch(function(erro) {
                    console.warn('Falha na busca ' + buscaAtual + ', pulando para a próxima: ' + erro);
                    buscaAtual++;
                    setTimeout(executarBusca, 1000);
                });
        }

        executarBusca();
    }

    // Controla o fluxo de requisições climáticas de forma ordenada
    function obterDadosDosPontos(pontos, indiceAtual) {
        // Quando terminar de mapear todos os pontos, renderiza a interface
        if (indiceAtual >= pontos.length) {
            exibirDashboard(monitoredPoints);
            mostrarCarregamento(false);
            if (loadBtn) loadBtn.style.display = 'none';
            if (refreshBtn) refreshBtn.style.display = 'inline-block';
            return;
        }

        var pontoAtual = pontos[indiceAtual];

        obterDadosClimaticos(parseFloat(pontoAtual.lat), parseFloat(pontoAtual.lon), function(clima) {
            if (clima !== null) {
                // Limpa o nome do local pegando apenas o termo principal antes da primeira vírgula
                var nomeCompleto = pontoAtual.display_name || pontoAtual.name || 'Ponto sem nome';
                var nomeCurto = nomeCompleto.split(',')[0].trim();
                
                monitoredPoints.push({
                    nome: nomeCurto,
                    lat: parseFloat(pontoAtual.lat),
                    lon: parseFloat(pontoAtual.lon),
                    clima: clima
                });
            }

            // Pequena pausa para evitar sobrecarga de requisições simultâneas
            setTimeout(function() {
                obterDadosDosPontos(pontos, indiceAtual + 1);
            }, 500);
        });
    }

    // Busca as condições meteorológicas em tempo real usando coordenadas aproximadas
    function obterDadosClimaticos(latitude, longitude, callback) {
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
                mostrarErro('Erro ao obter dados climáticos (ponto ignorado): ' + erro);
                callback(null);
            });
    }

    // Limpa a grade e reconstrói todos os cards na tela
    function exibirDashboard(pontos) {
        if (!dashboardGrid) return;
        dashboardGrid.innerHTML = '';

        for (var i = 0; i < pontos.length; i++) {
            var card = criarCard(pontos[i]);
            dashboardGrid.appendChild(card);
        }
    }

    // Monta a estrutura HTML interna de cada card individualmente
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

    // Sistema de pontuação baseado em limites críticos para avaliar o risco ambiental
    function calcularRisco(clima) {
        var riscoPontos = 0;

        if (clima.temperatura > 30) riscoPontos += 2;
        if (clima.temperatura > 35) riscoPontos += 2;

        if (clima.umidade < 40) riscoPontos += 2;
        if (clima.umidade < 20) riscoPontos += 2;

        if (clima.velocidadeVento > 20) riscoPontos += 2;
        if (clima.velocidadeVento > 30) riscoPontos += 2;

        if (clima.precipitacao < 1) riscoPontos += 1;

        if (riscoPontos <= 3) {
            return { classe: 'risk-low', texto: 'Risco Baixo', emoji: '✅' };
        } else if (riscoPontos <= 6) {
            return { classe: 'risk-medium', texto: 'Risco Moderado', emoji: '⚠️' };
        } else {
            return { classe: 'risk-high', texto: 'Risco Alto', emoji: '🚨' };
        }
    }

    // Reseta a lista atual e dispara a atualização em lote
    function atualizarDados() {
        mostrarCarregamento(true);
        limparErros();

        var pontosParaAtualizar = monitoredPoints.slice();
        monitoredPoints = [];

        atualizarPontosSequencial(pontosParaAtualizar, 0);
    }

    // Atualiza as informações meteorológicas sem precisar reconsultar a geolocalização
    function atualizarPontosSequencial(pontos, indice) {
        if (indice >= pontos.length) {
            exibirDashboard(monitoredPoints);
            mostrarCarregamento(false);
            return;
        }

        var pontoAtual = pontos[indice];

        obterDadosClimaticos(pontoAtual.lat, pontoAtual.lon, function(novoClima) {
            if (novoClima !== null) {
                monitoredPoints.push({
                    nome: pontoAtual.nome,
                    lat: pontoAtual.lat,
                    lon: pontoAtual.lon,
                    clima: novoClima
                });
            }

            setTimeout(function() {
                atualizarPontosSequencial(pontos, indice + 1);
            }, 500);
        });
    }

    // Funções de controle de estado visual da interface
    function mostrarCarregamento(visivel) {
        if (loadingIndicator) {
            loadingIndicator.style.display = visivel ? 'block' : 'none';
        }
    }

    function mostrarErro(mensagem) {
        if (errorMessage) {
            errorMessage.textContent = mensagem;
            errorMessage.style.display = 'block';
        }
    }

    function limparErros() {
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.style.display = 'none';
        }
    }

});