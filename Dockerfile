# API image (build context: repository root). The web client has its own image (web/Dockerfile); compose.yaml runs
# both with PostgreSQL.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Directory.Build.props GorevPanosu.sln ./
COPY src/GorevPanosu.Api/GorevPanosu.Api.csproj src/GorevPanosu.Api/
RUN dotnet restore src/GorevPanosu.Api/GorevPanosu.Api.csproj
COPY src/ src/
RUN dotnet publish src/GorevPanosu.Api/GorevPanosu.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
USER app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "GorevPanosu.Api.dll"]
