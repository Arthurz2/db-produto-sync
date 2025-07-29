Este script tem como objetivo sincronizar produtos entre dois bancos de dados diferentes. Ele realiza as seguintes operações de forma automatizada:

🔍 Verifique periodicamente se ocorreram alterações no banco de dados principal (como nome, preço ou estoque dos produtos).

➕ Insira novos produtos que ainda não existem no banco de dados secundário.

♻️ Atualiza automaticamente os dados de produtos modificados no banco principal para manter o secundário sempre em sincronia.

Ideal para cenários onde é necessário replicar ou manter um banco de dados auxiliar atualizado com as informações mais recentes do sistema principal.

Para rodar a sincronização basta executar, lembrando isso depende de como é a estrutura do seu banco: http://localhost:3000/sync
